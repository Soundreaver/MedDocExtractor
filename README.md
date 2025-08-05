# Medical Document Extractor

This is a web application that uses Google's Gemini AI to extract structured information from images of medical documents, including handwritten reports. Users can upload an image of a medical report, and the application will return both the transcribed text and a structured JSON object containing key medical data.

## Features

-   **AI-Powered Data Extraction:** Leverages the `gemini-1.5-pro-latest` model to intelligently parse medical documents.
-   **Handwriting Recognition:** Capable of performing OCR on both printed and handwritten text.
-   **Structured JSON Output:** Extracts key information (patient info, diagnosis, prescriptions, test results) into a clean, structured JSON format.
-   **Image Preview:** Allows users to preview the uploaded document image before processing.
-   **Simple Web Interface:** Built with Next.js and Tailwind CSS for a clean and responsive user experience.

## Technology Stack

-   **Framework:** [Next.js](https://nextjs.org/)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
-   **AI Model:** [Google Gemini 1.5 Pro](https://deepmind.google/technologies/gemini/)
-   **Language:** JavaScript

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

-   [Node.js](https://nodejs.org/en/) (version 18.x or later recommended)
-   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Soundreaver/MedDocExtractor.git
    cd MedDocExtractor
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```

### Configuration

1.  **Get a Google AI API Key:**
    -   Go to the [Google AI Studio](https://aistudio.google.com/apikey).
    -   Click **"Create API key in new project"** and copy the generated key.

2.  **No `.env` file needed:** The API key is entered directly into the application's UI, so you do not need to create a `.env` file.

## Usage

1.  **Run the development server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    ```

2.  **Open the application:**
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

3.  **Use the Extractor:**
    -   Paste your Google AI API key into the input field.
    -   Upload an image of a medical document.
    -   Click the **"Extract Data"** button to process the document.
    -   The extracted text and structured JSON data will be displayed on the screen.
