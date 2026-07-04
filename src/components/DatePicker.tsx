type DatePickerProps = {
  value: string;
  onChange: (date: string) => void;
};

export function DatePicker({ value, onChange }: DatePickerProps) {
  return (
    <label className="field">
      <span className="field-label">登録日</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    </label>
  );
}
