import {
  Action,
  ActionPanel,
  Alert,
  Color,
  Form,
  Icon,
  List,
  confirmAlert,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState, useCallback } from "react";
import { PostProcessor, loadProcessors, saveProcessors, getEffectiveName, getEffectivePrompt, isCustomized } from "./post-processors";

function useProcessors() {
  const [processors, setProcessors] = useState<PostProcessor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const loaded = await loadProcessors();
    setProcessors(loaded);
    setIsLoading(false);
  }, []);

  // Initial load
  if (isLoading && processors.length === 0) {
    refresh();
  }

  return { processors, isLoading, refresh };
}

function ProcessorForm({
  processor,
  onSave,
}: {
  processor?: PostProcessor;
  onSave: (name: string, prompt: string) => void;
}) {
  const { pop } = useNavigation();
  const [nameError, setNameError] = useState<string | undefined>();
  const [promptError, setPromptError] = useState<string | undefined>();

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={processor ? "Save" : "Create"}
            onSubmit={(values: { name: string; prompt: string }) => {
              if (!values.name.trim()) {
                setNameError("Name is required");
                return;
              }
              if (!values.prompt.trim()) {
                setPromptError("Prompt is required");
                return;
              }
              onSave(values.name.trim(), values.prompt.trim());
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="My Processor"
        defaultValue={processor ? getEffectiveName(processor) : ""}
        error={nameError}
        onChange={() => nameError && setNameError(undefined)}
      />
      <Form.TextArea
        id="prompt"
        title="Prompt"
        placeholder="Describe the transformation to apply..."
        defaultValue={processor ? getEffectivePrompt(processor) : ""}
        error={promptError}
        onChange={() => promptError && setPromptError(undefined)}
      />
    </Form>
  );
}

export default function Command() {
  const { processors, isLoading, refresh } = useProcessors();
  const { push } = useNavigation();

  async function toggle(processor: PostProcessor) {
    const updated = processors.map((p) => (p.id === processor.id ? { ...p, enabled: !p.enabled } : p));
    await saveProcessors(updated);
    await refresh();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= processors.length) return;
    const updated = [...processors];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    await saveProcessors(updated);
    await refresh();
  }

  async function deleteProcessor(processor: PostProcessor) {
    const confirmed = await confirmAlert({
      title: `Delete "${processor.name}"?`,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    const updated = processors.filter((p) => p.id !== processor.id);
    await saveProcessors(updated);
    await refresh();
  }

  function openCreateForm() {
    push(
      <ProcessorForm
        onSave={async (name, prompt) => {
          const newProcessor: PostProcessor = {
            id: `custom-${Date.now()}`,
            name,
            prompt,
            enabled: true,
            builtin: false,
          };
          const updated = [...(await loadProcessors()), newProcessor];
          await saveProcessors(updated);
          await refresh();
          await showToast({ style: Toast.Style.Success, title: `Created "${name}"` });
        }}
      />,
    );
  }

  function openEditForm(processor: PostProcessor) {
    push(
      <ProcessorForm
        processor={processor}
        onSave={async (name, prompt) => {
          const updated = processors.map((p) => {
            if (p.id !== processor.id) return p;
            if (p.builtin) {
              return {
                ...p,
                customName: name !== p.name ? name : undefined,
                customPrompt: prompt !== p.prompt ? prompt : undefined,
              };
            }
            return { ...p, name, prompt };
          });
          await saveProcessors(updated);
          await refresh();
          await showToast({ style: Toast.Style.Success, title: `Updated "${name}"` });
        }}
      />,
    );
  }

  async function resetProcessor(processor: PostProcessor) {
    const updated = processors.map((p) =>
      p.id === processor.id ? { ...p, customName: undefined, customPrompt: undefined } : p,
    );
    await saveProcessors(updated);
    await refresh();
    await showToast({ style: Toast.Style.Success, title: `Reset "${processor.name}" to default` });
  }

  function getTag(p: PostProcessor): { value: string; color: Color } {
    if (!p.builtin) return { value: "Custom", color: Color.Purple };
    if (isCustomized(p)) return { value: "Customized", color: Color.Orange };
    return { value: "Built-in", color: Color.Blue };
  }

  return (
    <List isLoading={isLoading} isShowingDetail>
      {processors.map((p, index) => (
        <List.Item
          key={p.id}
          title={getEffectiveName(p)}
          accessories={[
            p.enabled
              ? { icon: { source: Icon.CheckCircle, tintColor: Color.Green }, tooltip: "Enabled" }
              : { icon: { source: Icon.Circle, tintColor: Color.SecondaryText }, tooltip: "Disabled" },
            { tag: getTag(p) },
          ]}
          detail={<List.Item.Detail markdown={getEffectivePrompt(p)} />}
          actions={
            <ActionPanel>
              <Action
                title={p.enabled ? "Disable" : "Enable"}
                icon={p.enabled ? Icon.Circle : Icon.CheckCircle}
                onAction={() => toggle(p)}
              />
              <Action title="Create Custom Processor" icon={Icon.Plus} shortcut={{ modifiers: ["cmd"], key: "n" }} onAction={openCreateForm} />
              <Action title="Edit" icon={Icon.Pencil} shortcut={{ modifiers: ["cmd"], key: "e" }} onAction={() => openEditForm(p)} />
              {isCustomized(p) && (
                <Action title="Reset to Default" icon={Icon.RotateAntiClockwise} onAction={() => resetProcessor(p)} />
              )}
              {!p.builtin && (
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["ctrl"], key: "x" }}
                  onAction={() => deleteProcessor(p)}
                />
              )}
              {index > 0 && (
                <Action title="Move Up" icon={Icon.ArrowUp} shortcut={{ modifiers: ["cmd", "shift"], key: "arrowUp" }} onAction={() => move(index, -1)} />
              )}
              {index < processors.length - 1 && (
                <Action title="Move Down" icon={Icon.ArrowDown} shortcut={{ modifiers: ["cmd", "shift"], key: "arrowDown" }} onAction={() => move(index, 1)} />
              )}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
