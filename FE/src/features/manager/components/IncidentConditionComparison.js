import GaragePhotoPreview from '../../garage/components/GaragePhotoPreview';

const labels = { unchanged: 'Giữ nguyên', new: 'Lỗi mới', worsened: 'Nặng thêm', unverified: 'Chưa xác minh' };

function Defect({ item }) {
  return item ? <>
    <span>{item.location} · {item.description}</span>
    {item.photo_key && <GaragePhotoPreview photo={{ key: item.photo_key, name: item.location }} />}
  </> : <span>—</span>;
}

export default function IncidentConditionComparison({ comparison, ownerReturn = false }) {
  if (!comparison?.returned) return null;
  const { pickup, returned } = comparison;
  const before = pickup?.vehicle_condition?.defects || [];
  const after = returned.vehicle_condition?.defects || [];
  return <section>
    <h4>{ownerReturn ? 'Đối chiếu lúc tiếp nhận và trả xe cho chủ' : 'Đối chiếu biên bản giao và nhận trả'}</h4>
    <p>{ownerReturn ? 'Biên bản tiếp nhận' : 'Biên bản giao'} {pickup?._id || 'chưa có tham chiếu'} · Biên bản trả {returned._id}</p>
    {returned.renter_response === 'not_confirmed' && <p>Khách chưa xác nhận · {returned.renter_dispute_note}</p>}
    {returned.damage_changes?.length > 0 && <div className="requests-table-wrap"><table className="requests-table">
      <thead><tr><th>LÚC GIAO</th><th>LÚC TRẢ</th><th>CHÊNH LỆCH</th></tr></thead>
      <tbody>{returned.damage_changes.map(({ code, change }) => <tr key={code}>
        <td><Defect item={before.find((item) => item.code === code)} /></td>
        <td><Defect item={after.find((item) => item.code === code)} /></td>
        <td>{labels[change]}</td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
