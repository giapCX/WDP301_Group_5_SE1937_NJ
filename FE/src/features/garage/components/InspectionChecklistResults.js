import GaragePhotoPreview from './GaragePhotoPreview';
import { inspectionItems, inspectionResults } from '../data/inspectionChecklist';

export default function InspectionChecklistResults({ items }) {
  if (!items?.length) return null;
  return <ul className="gs-checklist-results">
    {inspectionItems.map(([key, label]) => {
      const item = items.find((entry) => entry.key === key);
      if (!item) return null;
      return <li key={key}>
        <strong>{label}</strong> · {inspectionResults[item.result]}
        {item.note && <p>{item.note}</p>}
        {item.photo_key && <GaragePhotoPreview photo={{ key: item.photo_key, name: label }} />}
      </li>;
    })}
  </ul>;
}
