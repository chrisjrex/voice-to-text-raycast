/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Sox Path - Path to sox binary */
  "soxPath": string,
  /** Python Path - Path to python3 binary with mlx-whisper or parakeet-mlx installed */
  "pythonPath": string,
  /** Save Transcription History - Save transcriptions to history for later review */
  "saveHistory": boolean,
  /** Transcription Output - Copy transcribed text to clipboard */
  "copyToClipboard": boolean,
  /**  - Paste transcribed text into the focused text field */
  "pasteToActiveApp": boolean,
  /** Silence Timeout (seconds) - Auto-stop recording after this many seconds of silence. Set to 0 to disable. */
  "silenceTimeout": string
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
}

