type DatePickerProps = {
  value: string;
  onChange: (date: string) => void;
};

export function DatePicker({ value, onChange }: DatePickerProps) {
  return (
    <label className="field">
      <span className="field-label">登録日</span>
      <span className="date-input-wrap">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input date-input"
        />
        <svg
          className="date-input-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </span>
    </label>
  );
}
