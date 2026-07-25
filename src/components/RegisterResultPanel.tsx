import { useEffect, useRef } from 'react';
import type { RegisterResult } from '../services/scheduleRegister';

type Props = {
  result: RegisterResult;
};

const CONFETTI_COLORS = ['#0891b2', '#059669', '#7c3aed', '#ea580c', '#0e7490', '#047857'];

function ConfettiBurst() {
  const pieces = Array.from({ length: 28 }, (_, index) => ({
    id: index,
    left: `${4 + ((index * 17) % 92)}%`,
    delay: `${(index % 7) * 0.04}s`,
    duration: `${0.9 + (index % 5) * 0.12}s`,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    rotate: `${(index * 43) % 360}deg`,
    size: index % 3 === 0 ? '0.45rem' : '0.3rem',
  }));

  return (
    <div className="register-confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="register-confetti-piece"
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            backgroundColor: piece.color,
            width: piece.size,
            height: piece.size,
            ['--rotate' as string]: piece.rotate,
          }}
        />
      ))}
    </div>
  );
}

export function RegisterResultPanel({ result }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const hasErrors = result.errors.length > 0;
  const createdTotal =
    result.calendarCreated + result.tasksCreated;
  const updatedTotal =
    result.calendarUpdated + result.tasksUpdated;
  const isSuccess = !hasErrors;

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  return (
    <section
      ref={panelRef}
      className={`register-result ${isSuccess ? 'register-result--success' : 'register-result--partial'}`}
      aria-live="polite"
    >
      {isSuccess && <ConfettiBurst />}

      <div className="register-result-glow" aria-hidden="true" />

      <div className="register-result-hero">
        <div className="register-result-icon" aria-hidden="true">
          <span className="register-result-icon-ring" />
          <span className="register-result-icon-mark">{isSuccess ? '✓' : '!'}</span>
        </div>
        <div>
          <p className="register-result-eyebrow">{isSuccess ? 'Complete' : 'Partial'}</p>
          <h2 className="register-result-title">
            {isSuccess ? '登録完了！' : '登録を完了しました'}
          </h2>
          <p className="register-result-subtitle">
            {isSuccess
              ? 'Google カレンダーと Todo への反映が終わりました。'
              : '一部の項目でエラーが発生しました。詳細を確認してください。'}
          </p>
        </div>
      </div>

      <div className="register-result-stats">
        {createdTotal > 0 && (
          <div className="register-stat register-stat--create">
            <span className="register-stat-value">{createdTotal}</span>
            <span className="register-stat-label">新規作成</span>
            <span className="register-stat-detail">
              カレンダー {result.calendarCreated} / Todo {result.tasksCreated}
            </span>
          </div>
        )}
        {updatedTotal > 0 && (
          <div className="register-stat register-stat--update">
            <span className="register-stat-value">{updatedTotal}</span>
            <span className="register-stat-label">更新</span>
            <span className="register-stat-detail">
              カレンダー {result.calendarUpdated} / Todo {result.tasksUpdated}
            </span>
          </div>
        )}
        {result.skipped > 0 && (
          <div className="register-stat register-stat--skip">
            <span className="register-stat-value">{result.skipped}</span>
            <span className="register-stat-label">省略</span>
            <span className="register-stat-detail">既存 Todo と同名</span>
          </div>
        )}
      </div>

      {result.skipped > 0 && (
        <p className="register-result-note">
          同名の Todo がすでにあるため、新規作成を省略しました。内容の更新は「更新」件数に含まれます。
        </p>
      )}

      {result.warnings.length > 0 && (
        <div className="register-result-alert register-result-alert--warning">
          <p className="register-result-alert-title">警告</p>
          <ul>
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="register-result-alert register-result-alert--error">
          <p className="register-result-alert-title">エラー</p>
          <ul>
            {result.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
