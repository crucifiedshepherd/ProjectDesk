type Props = { onClose: () => void };

export default function Notes({ onClose }: Props) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h1>Заметки</h1>
        <div className="row">
          <button className="btn">+ Новая заметка</button>
          <button className="btn ghost" onClick={onClose}>Закрыть</button>
        </div>
      </div>
      <div className="notes-grid">
        <div className="note-card">
          <span className="pill pill-orange">Бизнес-идея</span>
          <h3>Производство столов</h3>
          <div className="muted">Станки · цена продажи · маржа</div>
        </div>
        <div className="note-card">
          <span className="pill pill-blue">Свободная</span>
          <h3>Идея для приложения</h3>
          <div className="muted">Текстовая заметка в Markdown</div>
        </div>
      </div>
      <div className="muted small">Демо-карточки. Создание и хранение подключим следующим шагом.</div>
    </div>
  );
}