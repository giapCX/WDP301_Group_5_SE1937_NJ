const dateFields = ['ownerNotifiedAt', 'insurerNotifiedAt'];
const fields = [
  ['driverName', 'Người lái thực tế', 120],
  ['ownerNotifiedAt', 'Đã thông báo chủ xe lúc'],
  ['insurerNotifiedAt', 'Đã thông báo bảo hiểm lúc'],
  ['policeReference', 'Mã hồ sơ công an', 120],
  ['insurerReference', 'Mã hồ sơ bảo hiểm', 120],
  ['fieldResponder', 'Nhân viên được cử hỗ trợ hiện trường', 120],
  ['driverVerification', 'Đối chiếu người lái, GPLX và kết quả kiểm tra từ cơ quan có thẩm quyền', 1000],
  ['detentionProgress', 'Hồ sơ tạm giữ, người nhận xe và tình trạng nhận lại xe', 1000],
  ['insuranceProgress', 'Khai báo bảo hiểm, giám định và kết quả xử lý', 1000],
  ['repairProgress', 'Tiến độ sửa chữa và bàn giao lại xe', 1000],
];

export function readIncidentResponse(form) {
  return Object.fromEntries([...fields.map(([key]) => key), 'injuryStatus', 'missingDocuments'].flatMap((key) => {
    if (!form.has(key)) return [];
    const value = form.get(key);
    return [[key, dateFields.includes(key) ? (value ? new Date(`${value}+07:00`).toISOString() : null) : value]];
  }));
}

export default function IncidentResponseFields({ checklist = {} }) {
  return <fieldset>
    <legend>Checklist xử lý sự cố</legend>
    {fields.map(([key, label, maxLength]) => {
      const isDate = dateFields.includes(key);
      const value = checklist[key];
      const defaultValue = isDate && value ? new Date(+new Date(value) + 7 * 3600000).toISOString().slice(0, 16) : value || '';
      return <label key={key}>{label}{isDate && ' (giờ Việt Nam)'}
        <input name={key} type={isDate ? 'datetime-local' : 'text'} maxLength={maxLength} defaultValue={defaultValue} />
      </label>;
    })}
    <label>Tình trạng thương tích<select name="injuryStatus" defaultValue={checklist.injuryStatus || 'unknown'}>
      <option value="unknown">Chưa rõ</option><option value="none">Không ghi nhận</option><option value="reported">Có báo cáo thương tích</option>
    </select></label>
    <label>Tài liệu còn thiếu<textarea name="missingDocuments" maxLength={1000} defaultValue={checklist.missingDocuments || ''} /></label>
  </fieldset>;
}
