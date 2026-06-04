// admin-table.jsx — StatsBar + RestaurantTable (exported to window)

function StatsBar({ restaurants }) {
  const total      = restaurants.length;
  const withReview = restaurants.filter(r => r.review && r.review.trim()).length;
  const withImage  = restaurants.filter(r => r.image  && r.image.trim()).length;
  const topRated   = restaurants.filter(r => r.rating === 4).length;

  return (
    <div className="stats-row">
      <div className="stat-card">
        <span className="stat-label">Total Entries</span>
        <span className="stat-value">{total}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">With Review</span>
        <span className="stat-value">{withReview}</span>
        <span className="stat-delta" style={{color: withReview < total ? 'var(--c-red)' : 'var(--c-green)'}}>
          {total - withReview} missing
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-label">With Image</span>
        <span className="stat-value">{withImage}</span>
        <span className="stat-delta" style={{color: 'var(--c-n400)'}}>
          {total - withImage} missing
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Top Rated</span>
        <span className="stat-value">{topRated}</span>
        <span className="stat-delta" style={{color:'var(--c-n400)'}}>4-spoon entries</span>
      </div>
    </div>
  );
}

function PricePips({ price }) {
  return (
    <div className="price-pips">
      {[1,2,3,4].map(i => (
        <div key={i} className={`pip${i <= price ? ' on' : ''}`} />
      ))}
    </div>
  );
}

function SpoonCell({ rating }) {
  const r = window.RATINGS[rating] || window.RATINGS[0];
  return (
    <span className="spoon-cell">
      <span style={{fontSize:'1rem'}}>{r.emoji}</span>
      <span>{rating}</span>
    </span>
  );
}

function RestaurantTable({ restaurants, onEdit, onDelete }) {
  if (restaurants.length === 0) {
    return (
      <div className="adm-table-wrap">
        <div className="empty-state">No restaurants match your search.</div>
      </div>
    );
  }

  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th style={{width:40}}>#</th>
            <th>Restaurant</th>
            <th>Cuisine</th>
            <th style={{width:76}}>Price</th>
            <th style={{width:76}}>Spoons</th>
            <th style={{width:130}}>Updated</th>
            <th style={{width:150, textAlign:'right'}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {restaurants.map((r, i) => (
            <tr key={r.id}>
              <td style={{color:'var(--c-n400)', fontSize:'.8rem', fontVariantNumeric:'tabular-nums'}}>
                {String(i + 1).padStart(2, '0')}
              </td>
              <td>
                <div className="td-name">{r.name}</div>
                <div className="td-sub">
                  {r.detail}
                  {r.address ? ' · ' + r.address.split(',').pop().trim() : ''}
                </div>
              </td>
              <td>
                <span className="td-pill">{r.cuisine}</span>
              </td>
              <td>
                <PricePips price={r.price} />
              </td>
              <td>
                <SpoonCell rating={r.rating} />
              </td>
              <td style={{fontSize:'.8rem', color:'var(--c-n400)', fontVariantNumeric:'tabular-nums'}}>
                {r.updated}
              </td>
              <td>
                <div className="act-btns">
                  <button className="btn-act" onClick={() => onEdit(r)}>
                    <IconPencil /> Edit
                  </button>
                  <button className="btn-act danger" onClick={() => onDelete(r)}>
                    <IconTrash /> Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

Object.assign(window, { StatsBar, RestaurantTable });
