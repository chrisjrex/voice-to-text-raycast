/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Post-Processing Model - AI model used for post-processing transcriptions. Requires Raycast AI (Pro). */
  "aiModel": "OpenAI_GPT-4o_mini" | "Google_Gemini_3_Flash" | "Anthropic_Claude_4.5_Haiku",
  /** Transcription Output - Copy transcribed text to clipboard */
  "copyToClipboard": boolean,
  /**  - Paste transcribed text into the focused text field */
  "pasteToActiveApp": boolean,
  /** Save Transcription History - Save transcriptions to history for later review */
  "saveHistory": boolean,
  /** Transcription Silence Timeout (seconds) - Auto-stop recording after this many seconds of silence. Set to 0 to disable. */
  "silenceTimeout": string,
  /** TTS Engines - Enable Piper TTS engine. Requires: pip install piper-tts */
  "enablePiper": boolean,
  /** undefined - Enable Kokoro TTS engine. Requires: pip install kokoro */
  "enableKokoro": boolean,
  /** Kokoro Idle Timeout (seconds) - Auto-shutdown the Kokoro server after this many seconds of inactivity. Set to 0 to disable. */
  "kokoroIdleTimeout": string,
  /** Kokoro Python Path - Dedicated venv for Kokoro — kept separate to avoid dependency conflicts with STT/Piper packages */
  "kokoroPythonPath": string,
  /** Python Path [3.10+] - Python with mlx-whisper or parakeet-mlx installed. Used for speech-to-text transcription and Piper TTS */
  "pythonPath": string,
  /** Sox Path [14.4+] - Sox is used for audio recording during voice transcription */
  "soxPath": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `toggle-dictation` command */
  export type ToggleDictation = ExtensionPreferences & {}
  /** Preferences accessible in the `manage-models` command */
  export type ManageModels = ExtensionPreferences & {}
  /** Preferences accessible in the `manage-post-processing` command */
  export type ManagePostProcessing = ExtensionPreferences & {}
  /** Preferences accessible in the `manage-dictionary` command */
  export type ManageDictionary = ExtensionPreferences & {}
  /** Preferences accessible in the `transcription-history` command */
  export type TranscriptionHistory = ExtensionPreferences & {}
  /** Preferences accessible in the `read-aloud` command */
  export type ReadAloud = ExtensionPreferences & {}
  /** Preferences accessible in the `tts-menu-bar` command */
  export type TtsMenuBar = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `toggle-dictation` command */
  export type ToggleDictation = {}
  /** Arguments passed to the `manage-models` command */
  export type ManageModels = {}
  /** Arguments passed to the `manage-post-processing` command */
  export type ManagePostProcessing = {}
  /** Arguments passed to the `manage-dictionary` command */
  export type ManageDictionary = {}
  /** Arguments passed to the `transcription-history` command */
  export type TranscriptionHistory = {}
  /** Arguments passed to the `read-aloud` command */
  export type ReadAloud = {}
  /** Arguments passed to the `tts-menu-bar` command */
  export type TtsMenuBar = {}
}

