import { useEffect, useId, useRef, useState } from 'react';
import { earliestTripMinute } from '../reservationFormat.js';

const inputPattern = /^(\d{2})\/(\d{2})\/(\d{4}) ([01]\d|2[0-3]):([0-5]\d)$/;
const timeOptions = (length) => Array.from({ length }, (_, index) => String(index).padStart(2, '0'));
const hours = timeOptions(24);
const minutes = timeOptions(60);

function displayValue(value) {
  if (!value) return '';
  const [date, time] = value.split('T');
  return `${date.split('-').reverse().join('/')} ${time}`;
}

function parseValue(text) {
  const parts = inputPattern.exec(text.trim());
  if (!parts) return '';
  const [, day, month, year, hour, minute] = parts;
  const date = `${year}-${month}-${day}`;
  const calendarDay = new Date(date + 'T00:00:00Z');
  if (!Number.isFinite(+calendarDay) || calendarDay.toISOString().slice(0, 10) !== date) return '';
  return `${date}T${hour}:${minute}`;
}

export default function VietnamDateTimeField({ label, name, value, onChange, min, max, onTimeError }) {
  const [text, setText] = useState(() => displayValue(value));
  const [draft, setDraft] = useState(null);
  const input = useRef(null);
  const id = useId();
  const parsed = parseValue(text);
  const rangeError = (time) => {
    if (min && time < min) return `Ngày giờ phải từ ${displayValue(min)} trở đi.`;
    if (max && time > max) return `Ngày giờ không được sau ${displayValue(max)}.`;
    return '';
  };
  const error = parsed
    ? rangeError(parsed)
    : text.trim() ? 'Nhập ngày có thật theo DD/MM/YYYY HH:mm (24 giờ).' : 'Vui lòng nhập ngày giờ.';
  const pickedValue = draft?.day ? `${draft.day}T${draft.hour}:${draft.minute}` : '';
  const pickerError = pickedValue ? rangeError(pickedValue) : '';

  useEffect(() => {
    input.current.setCustomValidity(error);
  }, [error]);

  function updateText(next) {
    setText(next);
    onChange(parseValue(next));
  }

  function togglePicker() {
    if (draft) {
      setDraft(null);
      return;
    }
    const [day, time] = (parsed || min || earliestTripMinute()).split('T');
    const [hour, minute] = time.split(':');
    setDraft({ day, hour, minute });
  }

  return (
    <div className="rv-datetime">
      <label htmlFor={id}>{label}</label>
      <div className="rv-datetime-entry">
        <input id={id} ref={input} type="text" required maxLength={16} placeholder="DD/MM/YYYY HH:mm"
          value={text} onChange={(event) => updateText(event.currentTarget.value)} onInvalid={(event) => {
            event.preventDefault();
            onTimeError(label + '. ' + event.currentTarget.validationMessage);
          }}/>
        <button type="button" className="rv-button" onClick={togglePicker} aria-expanded={Boolean(draft)}
          aria-controls={draft ? id + '-picker' : undefined}>Chọn</button>
      </div>
      {draft && (
        <div id={id + '-picker'} className="rv-datetime-picker" role="group" aria-label={label}>
          <label>Ngày<input type="date" value={draft.day} min={min?.split('T')[0]} max={max?.split('T')[0]}
            onInput={(event) => setDraft({ ...draft, day: event.currentTarget.value })}/></label>
          <label>Giờ<select value={draft.hour} onChange={(event) => setDraft({ ...draft, hour: event.currentTarget.value })}>
            {hours.map((hour) => <option key={hour}>{hour}</option>)}
          </select></label>
          <label>Phút<select value={draft.minute} onChange={(event) => setDraft({ ...draft, minute: event.currentTarget.value })}>
            {minutes.map((minute) => <option key={minute}>{minute}</option>)}
          </select></label>
          {pickerError && <small className="rv-datetime-feedback" role="status">{pickerError}</small>}
          <button type="button" className="rv-button rv-primary" disabled={!pickedValue || Boolean(pickerError)}
            onClick={() => { updateText(displayValue(pickedValue)); setDraft(null); }}>Áp dụng</button>
        </div>
      )}
      <input type="hidden" name={name} value={parsed}/>
    </div>
  );
}
