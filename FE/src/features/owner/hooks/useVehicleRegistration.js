import { useState } from 'react';
import { registerOwnerVehicle } from '../api/ownerApi';

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, contentType: file.type, data: reader.result });
    reader.onerror = () => reject(new Error(`Không đọc được tệp ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export default function useVehicleRegistration() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (form) => {
    setSaving(true);
    setError('');
    try {
      const [registration, inspectionCertificate, insurance, ...photos] = await Promise.all([
        readFile(form.registration), readFile(form.inspectionCertificate),
        readFile(form.insurance), ...form.photos.map(readFile),
      ]);
      const result = await registerOwnerVehicle({
        brand: form.brand, model: form.model, licensePlate: form.licensePlate,
        year: Number(form.year), seats: Number(form.seats), vehicleType: form.vehicleType,
        transmission: form.transmission, fuelType: form.fuelType,
        dailyPrice: Number(form.dailyPrice), mileageLimit: Number(form.mileageLimit),
        extraMileageFee: Number(form.extraMileageFee), description: form.description, conditionDeclaration: form.conditionDeclaration, vin: form.vin, ownerContactAddress: form.ownerContactAddress, publishVehiclePhotos: form.publishVehiclePhotos,
        acceptedTerms: form.acceptedTerms,
        documents: { registration, inspectionCertificate, insurance }, photos,
      });
      return result.data;
    } catch (reason) {
      setError(reason.message || 'Không gửi được hồ sơ. Vui lòng thử lại.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { submit, saving, error };
}
