import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Icon,
  List,
  useNavigation,
} from "@raycast/api";
import { Form } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { DictionaryEntry, loadDictionary, saveDictionary } from "./dictionary";

function AddTermForm({ onAdd }: { onAdd: (term: string) => void }) {
  const { pop } = useNavigation();

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Add Term"
            onSubmit={(values: { term: string }) => {
              const term = values.term.trim();
              if (term) {
                onAdd(term);
                pop();
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="term"
        title="Term"
        placeholder="e.g. CCY, Séamus"
        autoFocus
      />
    </Form>
  );
}

export default function ManageDictionary() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDictionary().then((loaded) => {
      setEntries(loaded);
      setIsLoading(false);
    });
  }, []);

  const addTerm = useCallback(
    async (term: string) => {
      const entry: DictionaryEntry = { id: Date.now().toString(), term };
      const updated = [...entries, entry];
      setEntries(updated);
      await saveDictionary(updated);
    },
    [entries],
  );

  const deleteTerm = useCallback(
    async (id: string) => {
      if (
        await confirmAlert({
          title: "Delete Term",
          message:
            "Are you sure you want to remove this term from the dictionary?",
          primaryAction: {
            title: "Delete",
            style: Alert.ActionStyle.Destructive,
          },
        })
      ) {
        const updated = entries.filter((e) => e.id !== id);
        setEntries(updated);
        await saveDictionary(updated);
      }
    },
    [entries],
  );

  return (
    <List isLoading={isLoading}>
      <List.Section
        title="Protected Terms"
        subtitle="Terms listed here will be preserved exactly as written during AI post-processing"
      >
        {entries.map((entry) => (
          <List.Item
            key={entry.id}
            title={entry.term}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Add Term"
                  icon={Icon.Plus}
                  shortcut={{ modifiers: ["cmd"], key: "n" }}
                  target={<AddTermForm onAdd={addTerm} />}
                />
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["ctrl"], key: "x" }}
                  onAction={() => deleteTerm(entry.id)}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      <List.Section>
        {entries.length === 0 && !isLoading && (
          <List.Item
            title="No terms yet"
            subtitle="Press ⌘N to add a protected term"
            actions={
              <ActionPanel>
                <Action.Push
                  title="Add Term"
                  icon={Icon.Plus}
                  shortcut={{ modifiers: ["cmd"], key: "n" }}
                  target={<AddTermForm onAdd={addTerm} />}
                />
              </ActionPanel>
            }
          />
        )}
      </List.Section>
    </List>
  );
}
