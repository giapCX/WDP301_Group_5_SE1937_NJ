import { SUPPORTED_VEHICLE_SEAT_COUNTS } from '../../renter-reservations/vehicleSeatCounts.js';
import palisade from '../../../assets/images/vehicles/suv-palisade.jpg';
import fortuner from '../../../assets/images/vehicles/suv-fortuner.jpg';
import santaFe from '../../../assets/images/vehicles/suv-santa-fe.jpg';
import carnival from '../../../assets/images/vehicles/mpv-carnival.jpg';
import passengerVan from '../../../assets/images/vehicles/passenger-van.jpg';
import tourBus from '../../../assets/images/vehicles/tour-bus.jpg';
import coaster from '../../../assets/images/vehicles/toyota-coaster.jpg';

const [sevenSeats, nineSeats, sixteenSeats, twentyNineSeats] = SUPPORTED_VEHICLE_SEAT_COUNTS;
const photosBySeatCount = Object.freeze({
  [sevenSeats]: Object.freeze([palisade, fortuner, santaFe]),
  [nineSeats]: Object.freeze([carnival, passengerVan]),
  [sixteenSeats]: Object.freeze([passengerVan]),
  [twentyNineSeats]: Object.freeze([coaster, tourBus]),
});

function validPhotos(value) {
  return Array.isArray(value)
    ? value.filter((source) => typeof source === 'string' && /^https?:\/\/\S+$/i.test(source))
    : [];
}

function stableIndex(value, length) {
  let hash = 0;
  for (const character of String(value || '')) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % length;
}

export function getVehicleReferencePhoto(seatCount = SUPPORTED_VEHICLE_SEAT_COUNTS[0], key = '') {
  const photos = photosBySeatCount[Number(seatCount)] || [];
  if (!photos.length) return null;

  return {
    src: photos[stableIndex(key, photos.length)],
    isReference: true,
  };
}

export function getPrimaryVehiclePhoto(vehicle) {
  const [photo] = validPhotos(vehicle?.photos);
  const seatCount = vehicle?.seats ?? vehicle?.seat_count;
  const modelKey = [vehicle?.brand, vehicle?.model, seatCount].filter(Boolean).join(' ');
  const referencePhoto = getVehicleReferencePhoto(seatCount, modelKey);

  if (photo) {
    return { src: photo, isReference: false, fallback: referencePhoto };
  }

  return referencePhoto;
}