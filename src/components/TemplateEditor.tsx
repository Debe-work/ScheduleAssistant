import { useState } from 'react';
import { HelpHint } from './HelpHint';
import {
  CHILD_OPTIONAL_FIELDS,
  PARENT_OPTIONAL_FIELDS,
  createEmptyChildTask,
  createEmptyParentTask,
  formToTemplate,
  templateToForm,
  validateTemplateForm,
  type ChildOptionalKey,
  type ChildTaskForm,
  type ParentOptionalKey,
  type ParentTaskForm,
} from '../utils/templateForm';
import type { DailyTaskTemplate } from '../types';

type TemplateEditorProps = {
  initialTemplates: DailyTaskTemplate[];
  usingCustom: boolean;
  onSave: (templates: DailyTaskTemplate[]) => void;
  onReset: () => void;
};

export function TemplateEditor({
  initialTemplates,
  usingCustom,
  onSave,
  onReset,
}: TemplateEditorProps) {
  const [tasks, setTasks] = useState<ParentTaskForm[]>(() => templateToForm(initialTemplates));
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(() => new Set([0]));
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const toggleTaskExpanded = (index: number) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const updateTask = (index: number, updater: (task: ParentTaskForm) => ParentTaskForm) => {
    setTasks((prev) => prev.map((task, i) => (i === index ? updater(task) : task)));
    setSavedMessage(null);
  };

  const addParentField = (taskIndex: number, field: ParentOptionalKey) => {
    updateTask(taskIndex, (task) => {
      if (task.activeFields.includes(field)) return task;
      const next: ParentTaskForm = {
        ...task,
        activeFields: [...task.activeFields, field],
      };
      if (field === 'children' && next.children.length === 0) {
        next.children = [createEmptyChildTask()];
      }
      return next;
    });
  };

  const removeParentField = (taskIndex: number, field: ParentOptionalKey) => {
    updateTask(taskIndex, (task) => ({
      ...task,
      activeFields: task.activeFields.filter((key) => key !== field),
    }));
  };

  const addChildField = (taskIndex: number, childIndex: number, field: ChildOptionalKey) => {
    updateTask(taskIndex, (task) => ({
      ...task,
      children: task.children.map((child, i) =>
        i === childIndex && !child.activeFields.includes(field)
          ? { ...child, activeFields: [...child.activeFields, field] }
          : child,
      ),
    }));
  };

  const removeChildField = (taskIndex: number, childIndex: number, field: ChildOptionalKey) => {
    updateTask(taskIndex, (task) => ({
      ...task,
      children: task.children.map((child, i) =>
        i === childIndex
          ? { ...child, activeFields: child.activeFields.filter((key) => key !== field) }
          : child,
      ),
    }));
  };

  const handleSave = () => {
    const validationError = validateTemplateForm(tasks);
    if (validationError) {
      setError(validationError);
      setSavedMessage(null);
      return;
    }

    setError(null);
    onSave(formToTemplate(tasks));
    setSavedMessage('テンプレートを保存しました');
  };

  const handleReset = () => {
    if (!window.confirm('デフォルトのテンプレートに戻しますか？カスタム設定は削除されます。')) {
      return;
    }
    setError(null);
    setSavedMessage(null);
    onReset();
  };

  return (
    <div className="template-editor">
      <p className="template-editor-source">
        {usingCustom ? 'カスタム設定を使用中' : 'デフォルトのテンプレートを使用中'}
      </p>

      <div className="template-editor-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
          setTasks((prev) => [...prev, createEmptyParentTask()]);
          setExpandedTasks((prev) => new Set([...prev, tasks.length]));
          setSavedMessage(null);
        }}>
          タスクを追加
        </button>
      </div>

      <div className="template-editor-list">
        {tasks.map((task, taskIndex) => {
          const expanded = expandedTasks.has(taskIndex);
          const availableParentFields = PARENT_OPTIONAL_FIELDS.filter(
            (field) => !task.activeFields.includes(field.key),
          );

          return (
            <article key={taskIndex} className="template-task-card">
              <header className="template-task-header">
                <button
                  type="button"
                  className="template-task-toggle"
                  aria-expanded={expanded}
                  onClick={() => toggleTaskExpanded(taskIndex)}
                >
                  <span className={`accordion-chevron${expanded ? ' accordion-chevron--open' : ''}`}>
                    ›
                  </span>
                  <span className="template-task-title">
                    {task.name.trim() || `タスク ${taskIndex + 1}`}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm template-task-remove"
                  onClick={() => {
                    if (!window.confirm('このタスクを削除しますか？')) return;
                    setTasks((prev) => prev.filter((_, i) => i !== taskIndex));
                    setSavedMessage(null);
                  }}
                >
                  削除
                </button>
              </header>

              {expanded && (
                <div className="template-task-body">
                  <label className="field">
                    <span className="field-label">名前 (name) *</span>
                    <input
                      className="input input-sm"
                      value={task.name}
                      onChange={(e) =>
                        updateTask(taskIndex, (current) => ({ ...current, name: e.target.value }))
                      }
                      placeholder="例: 起床"
                    />
                  </label>

                  {task.activeFields.map((fieldKey) => {
                    const meta = PARENT_OPTIONAL_FIELDS.find((field) => field.key === fieldKey);
                    if (!meta) return null;

                    if (fieldKey === 'children') {
                      return (
                        <div key={fieldKey} className="template-field-block">
                          <div className="template-field-header">
                            <span className="template-field-label">
                              {meta.label}
                              <HelpHint label={`${meta.label}の説明`}>
                                <p>{meta.description}</p>
                              </HelpHint>
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => removeParentField(taskIndex, fieldKey)}
                            >
                              削除
                            </button>
                          </div>

                          <div className="template-children-list">
                            {task.children.map((child, childIndex) => (
                              <ChildTaskEditor
                                key={childIndex}
                                child={child}
                                onChange={(nextChild) =>
                                  updateTask(taskIndex, (current) => ({
                                    ...current,
                                    children: current.children.map((item, i) =>
                                      i === childIndex ? nextChild : item,
                                    ),
                                  }))
                                }
                                onAddField={(field) => addChildField(taskIndex, childIndex, field)}
                                onRemoveField={(field) =>
                                  removeChildField(taskIndex, childIndex, field)
                                }
                                onRemove={() =>
                                  updateTask(taskIndex, (current) => ({
                                    ...current,
                                    children: current.children.filter((_, i) => i !== childIndex),
                                  }))
                                }
                              />
                            ))}
                          </div>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              updateTask(taskIndex, (current) => ({
                                ...current,
                                children: [...current.children, createEmptyChildTask()],
                              }))
                            }
                          >
                            子タスクを追加
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div key={fieldKey} className="template-field-block">
                        <div className="template-field-header">
                          <span className="template-field-label">
                            {meta.label} ({fieldKey})
                            <HelpHint label={`${meta.label}の説明`}>
                              <p>{meta.description}</p>
                            </HelpHint>
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => removeParentField(taskIndex, fieldKey)}
                          >
                            削除
                          </button>
                        </div>

                        {meta.inputType === 'boolean' ? (
                          <label className="template-checkbox">
                            <input
                              type="checkbox"
                              checked={task.defaultComplete}
                              onChange={(e) =>
                                updateTask(taskIndex, (current) => ({
                                  ...current,
                                  defaultComplete: e.target.checked,
                                }))
                              }
                            />
                            <span>登録時に完了状態にする</span>
                          </label>
                        ) : (
                          <input
                            className="input input-sm"
                            value={getParentTextValue(task, fieldKey)}
                            onChange={(e) =>
                              updateTask(taskIndex, (current) => ({
                                ...current,
                                [fieldKey]: e.target.value,
                              }))
                            }
                          />
                        )}
                      </div>
                    );
                  })}

                  {availableParentFields.length > 0 && (
                    <label className="field template-add-field">
                      <span className="field-label">パラメータを追加</span>
                      <select
                        className="input input-sm"
                        value=""
                        onChange={(e) => {
                          const value = e.target.value as ParentOptionalKey | '';
                          if (!value) return;
                          addParentField(taskIndex, value);
                        }}
                      >
                        <option value="">選択してください</option>
                        {availableParentFields.map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.label} ({field.key})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {error && <p className="error">{error}</p>}
      {savedMessage && <p className="status-ok">{savedMessage}</p>}

      <div className="template-editor-footer">
        <button type="button" className="btn btn-primary btn-block" onClick={handleSave}>
          保存
        </button>
        {usingCustom && (
          <button type="button" className="btn btn-secondary btn-block" onClick={handleReset}>
            デフォルトに戻す
          </button>
        )}
      </div>
    </div>
  );
}

type ChildTaskEditorProps = {
  child: ChildTaskForm;
  onChange: (child: ChildTaskForm) => void;
  onAddField: (field: ChildOptionalKey) => void;
  onRemoveField: (field: ChildOptionalKey) => void;
  onRemove: () => void;
};

function ChildTaskEditor({
  child,
  onChange,
  onAddField,
  onRemoveField,
  onRemove,
}: ChildTaskEditorProps) {
  const availableFields = CHILD_OPTIONAL_FIELDS.filter(
    (field) => !child.activeFields.includes(field.key),
  );

  return (
    <div className="template-child-card">
      <div className="template-child-header">
        <span className="template-child-label">子タスク</span>
        <button type="button" className="btn btn-ghost btn-sm timeline-remove" onClick={onRemove}>
          削除
        </button>
      </div>

      <label className="field">
        <span className="field-label">名前 (name) *</span>
        <input
          className="input input-sm"
          value={child.name}
          onChange={(e) => onChange({ ...child, name: e.target.value })}
          placeholder="例: 朝食"
        />
      </label>

      {child.activeFields.map((fieldKey) => {
        const meta = CHILD_OPTIONAL_FIELDS.find((field) => field.key === fieldKey);
        if (!meta) return null;

        return (
          <div key={fieldKey} className="template-field-block template-field-block--child">
            <div className="template-field-header">
              <span className="template-field-label">
                {meta.label} ({fieldKey})
                <HelpHint label={`${meta.label}の説明`}>
                  <p>{meta.description}</p>
                </HelpHint>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onRemoveField(fieldKey)}
              >
                削除
              </button>
            </div>

            {meta.inputType === 'boolean' ? (
              <label className="template-checkbox">
                <input
                  type="checkbox"
                  checked={child.defaultComplete}
                  onChange={(e) => onChange({ ...child, defaultComplete: e.target.checked })}
                />
                <span>登録時に完了状態にする</span>
              </label>
            ) : (
              <input
                className="input input-sm"
                value={getChildTextValue(child, fieldKey)}
                onChange={(e) => onChange({ ...child, [fieldKey]: e.target.value })}
              />
            )}
          </div>
        );
      })}

      {availableFields.length > 0 && (
        <label className="field template-add-field">
          <span className="field-label">パラメータを追加</span>
          <select
            className="input input-sm"
            value=""
            onChange={(e) => {
              const value = e.target.value as ChildOptionalKey | '';
              if (!value) return;
              onAddField(value);
            }}
          >
            <option value="">選択してください</option>
            {availableFields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label} ({field.key})
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function getParentTextValue(task: ParentTaskForm, fieldKey: ParentOptionalKey): string {
  if (fieldKey === 'children' || fieldKey === 'defaultComplete') return '';
  return task[fieldKey];
}

function getChildTextValue(child: ChildTaskForm, fieldKey: ChildOptionalKey): string {
  if (fieldKey === 'defaultComplete') return '';
  return child[fieldKey];
}
