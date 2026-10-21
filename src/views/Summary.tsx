type Props = { onClose: () => void };

export default function Summary({ onClose }: Props) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h1>Сводка</h1>
        <button className="btn ghost" onClick={onClose}>Закрыть</button>
      </div>
      <div className="summary-grid">
        <div className="card">
          <h2>Производство столов</h2>
          <div className="kv"><span>Цена станков</span><b>450 000 ₽</b></div>
          <div className="kv"><span>Цена продажи</span><b>18 000 ₽</b></div>
          <div className="kv"><span>Маржа</span><b>35%</b></div>
          <div className="kv"><span>Цена материалов</span><b className="missing">—</b></div>
        </div>
        <div className="card">
          <h2>Сбережения</h2>
          <div className="stat-value accent-blue">1 240 000 ₽</div>
          <div className="muted small">Счета, график и ввод данных подключим позже</div>
        </div>
      </div>
      <div className="muted small">Демо-данные: так будет выглядеть подсветка незаполненных полей.</div>
    </div>
  );
}