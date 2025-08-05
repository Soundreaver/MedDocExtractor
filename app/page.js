"use client";

import { useState, useRef } from "react";
import Image from "next/image";

// This is the main component for your page.
export default function MedicalDocumentExtractorPage() {
  // State variables to manage the application's data and UI status.
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [rawText, setRawText] = useState("");
  const [structuredData, setStructuredData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // A ref to the hidden file input element.
  const fileInputRef = useRef(null);

  // Handles the file selection when the user chooses a file.
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  // Converts the selected file to a base64 string for API calls.
  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = (error) => reject(error);
    });

  // Main function to handle the extraction process when the button is clicked.
  const handleProcessClick = async () => {
    if (!file) {
      setErrorMessage("Please upload a file first.");
      return;
    }
    if (!apiKey) {
      setErrorMessage("Please enter your Google AI API key.");
      return;
    }

    // Reset UI for a new process
    setErrorMessage("");
    setRawText("");
    setStructuredData(null);
    setIsLoading(true);
    setStatusMessage("Processing document...");

    try {
      const base64Content = await toBase64(file);
      const mimeType = file.type;

      // Call Gemini with the image and prompt
      const { extractedText, extractedData } =
        await extractMedicalDataWithGemini(base64Content, mimeType);

      setRawText(extractedText);
      setStructuredData(extractedData);
    } catch (error) {
      console.error("Error during processing:", error);
      setErrorMessage(error.message || "An unknown error occurred.");
    } finally {
      // Finalize UI
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  /**
   * Calls the Gemini API to perform OCR and extract structured data from an image.
   * This function now handles both handwriting recognition and data structuring.
   * @param {string} imageBase64Content The base64 encoded image data.
   * @param {string} mimeType The MIME type of the image (e.g., 'image/jpeg').
   * @returns {Promise<{extractedText: string, extractedData: Object}>} The extracted text and structured data.
   */
  async function extractMedicalDataWithGemini(imageBase64Content, mimeType) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;

    const prompt = `
      You are a highly intelligent medical data extraction assistant with advanced OCR capabilities.
      Your task is to analyze the provided image of a medical document, which may contain printed or handwritten text.

      First, perform OCR to transcribe all the text from the image accurately.
      
      Second, based on the transcribed text, extract the key information and return a single, valid JSON object.

      The JSON object must have the following structure:
      {
        "transcribedText": "The full text transcribed from the document.",
        "structuredData": {
          "patientInfo": {
            "name": "The patient's full name. If not present, use null.",
            "dob": "The patient's date of birth. If not present, use null.",
            "reportDate": "The date the report was generated. If not present, use null."
          },
          "diagnosis": "The diagnosis mentioned in the report. If not present, use null.",
          "prescriptions": [
            {
              "medication": "The name of the prescribed medication.",
              "dosage": "The dosage instructions (e.g., '1 tablet twice a day').",
              "duration": "The duration of the prescription (e.g., 'for 10 days')."
            }
          ],
          "testResults": [
            {
              "testName": "The name of the test (e.g., 'Hemoglobin A1c').",
              "value": "The result of the test.",
              "unit": "The unit of measurement (e.g., 'mg/dL').",
              "referenceRange": "The normal reference range."
            }
          ]
        }
      }

      If a value or section (like prescriptions) is not found, use null or an empty array [].
      Do not include any text, explanations, or markdown formatting outside of the final JSON object.
    `;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64Content,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: "application/json",
      },
    };

    const response = await fetchWithRetry(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error("Invalid response structure from Gemini API.");
    }

    try {
      const parsedJson = JSON.parse(responseText);
      return {
        extractedText: parsedJson.transcribedText,
        extractedData: parsedJson.structuredData,
      };
    } catch (e) {
      console.error("Failed to parse JSON from Gemini response:", responseText);
      throw new Error(
        "Gemini API did not return valid JSON. See raw text for details."
      );
    }
  }

  /**
   * A wrapper around the fetch API that includes a robust retry mechanism with exponential backoff and jitter.
   * This is useful for handling transient server errors like 503 Service Unavailable or 429 Too Many Requests.
   * @param {string} url The URL to fetch.
   * @param {object} options The options for the fetch request.
   * @param {number} retries The number of retries to attempt.
   * @returns {Promise<Response>} The fetch response.
   */
  async function fetchWithRetry(url, options, retries = 4) {
    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);

        // Check for retryable server errors (5xx) or rate limiting (429)
        if (response.status >= 500 || response.status === 429) {
          const error = new Error(`API returned status ${response.status}`);
          error.status = response.status; // Attach status for inspection
          throw error;
        }

        // For other non-ok responses (e.g., 400 Bad Request), fail fast
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `API error: ${errorData.error?.message || "Unknown error"}`
          );
        }

        return response; // Success
      } catch (error) {
        lastError = error;

        // If the error is not a retryable one, break the loop and throw
        if (!error.status) {
          throw lastError;
        }

        // If this is the last retry, break the loop to throw a custom error
        if (i === retries - 1) {
          break;
        }

        // Wait with exponential backoff and jitter
        const delay = 2 ** i * 1000 + Math.random() * 1000;
        console.log(
          `Attempt ${i + 1} failed with status ${
            error.status
          }. Retrying in ${Math.round(delay / 1000)}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // If all retries fail, throw a more user-friendly error for retryable statuses
    if (lastError.status) {
      throw new Error(
        `The AI service is temporarily unavailable (Error ${lastError.status}). Please try again in a few moments.`
      );
    }

    // Re-throw any other error that occurred
    throw lastError;
  }

  // The JSX that defines the UI of the component.
  return (
    <main className="bg-gray-50 text-gray-800 font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Medical Document Extractor
          </h1>
          <p className="mt-2 text-md text-gray-600">
            Upload a medical report to extract structured data using Google AI.
          </p>
        </header>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
          {/* API Key Input */}
          <div className="mb-6">
            <label
              htmlFor="apiKey"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Enter Your Google AI API Key
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Enter your API key here"
            />
            <p className="mt-2 text-xs text-gray-500">
              Get a free key from{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                Google AI Studio.
              </a>
              <br />
              <br />
              You also need to have the Cloud Vision API enabled in your Google
              Cloud project. If you haven't done this, go to the{" "}
              <a
                href="https://console.cloud.google.com/apis/library/vision.googleapis.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                Google AI Studio{" "}
              </a>
              page in the Google Cloud Console and click "Enable". The same
              project should be associated with your API key.
            </p>
          </div>

          {/* File Upload */}
          <div className="mb-4">
            <label
              htmlFor="file-upload"
              className="block text-sm font-medium text-gray-700"
            >
              Upload Document Image
            </label>
            <div
              className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:border-indigo-500"
              onClick={() => fileInputRef.current.click()}
            >
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <span className="relative bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                    <span>Upload a file</span>
                  </span>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                <input
                  id="file-upload"
                  ref={fileInputRef}
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>

          {/* Image Preview */}
          {previewUrl && (
            <div className="mb-6">
              <p className="block text-sm font-medium text-gray-700 mb-2">
                Image Preview:
              </p>
              <Image
                src={previewUrl}
                width={500}
                height={500}
                className="max-w-full max-h-64 mx-auto rounded-lg shadow-md"
                alt="Image preview"
              />
            </div>
          )}

          {/* Action Button */}
          <div className="text-center">
            <button
              onClick={handleProcessClick}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed"
              disabled={!file || !apiKey || isLoading}
            >
              {isLoading ? "Processing..." : "Extract Data"}
            </button>
          </div>
        </div>

        {/* Status and Loader */}
        {isLoading && (
          <div className="text-center my-6">
            <div className="flex justify-center items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mr-3"></div>
              <p className="text-lg font-medium text-gray-700">
                {statusMessage || "Processing..."}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div
            className="my-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative"
            role="alert"
          >
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        {/* Results Section */}
        {(rawText || structuredData) && !isLoading && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Extraction Results
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Raw Text */}
              <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  1. Transcribed Text
                </h3>
                <pre className="text-sm bg-gray-100 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono h-96">
                  {rawText}
                </pre>
              </div>
              {/* Structured Data */}
              <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  2. Structured Data
                </h3>
                <pre className="text-sm bg-gray-100 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono h-96">
                  {JSON.stringify(structuredData, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
