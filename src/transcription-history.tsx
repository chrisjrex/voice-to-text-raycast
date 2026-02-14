import { Action, ActionPanel, Alert, Color, confirmAlert, Icon, List } from "@raycast/api";
import { useState } from "react";
import { HistoryEntry, loadHistory, saveHistory } from "./history";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export default function TranscriptionHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory);

  async function deleteEntry(id: string) {
    if (
      await confirmAlert({
        title: "Delete Transcription",
        message: "Are you sure you want to delete this transcription?",
        primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
      })
    ) {
      const updated = entries.filter((e) => e.id !== id);
      saveHistory(updated);
      setEntries(updated);
    }
  }

  async function deleteAll() {
    if (
      await confirmAlert({
        title: "Delete All History",
        message: "Are you sure you want to delete all transcription history?",
        primaryAction: { title: "Delete All", style: Alert.ActionStyle.Destructive },
      })
    ) {
      saveHistory([]);
      setEntries([]);
    }
  }

  return (
    <List isShowingDetail searchBarPlaceholder="Search transcriptions...">
      {entries.length === 0 ? (
        <List.EmptyView title="No Transcriptions" description="Transcriptions will appear here after you dictate." />
      ) : (
        entries.map((entry) => (
          <List.Item
            key={entry.id}
            title={truncate(entry.text, 60)}

            detail={
              <List.Item.Detail
                markdown={entry.text}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Transcribed On" text={formatDate(entry.timestamp)} />
                    <List.Item.Detail.Metadata.Label title="Characters" text={String(entry.text.length)} />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <ActionPanel.Section title="Transcription">
                  <Action.CopyToClipboard title="Copy Text" content={entry.text} />
                  <Action.Paste title="Paste Text" content={entry.text} shortcut={{ modifiers: ["cmd"], key: "enter" }} />
                </ActionPanel.Section>
                <ActionPanel.Section title="Manage History">
                  <Action
                    title="Delete Item"
                    icon={{ source: Icon.Trash, tintColor: Color.Red }}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                    onAction={() => deleteEntry(entry.id)}
                  />
                  <Action
                    title="Delete All History"
                    icon={{ source: Icon.Trash, tintColor: Color.Red }}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl", "shift"], key: "x" }}
                    onAction={deleteAll}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
