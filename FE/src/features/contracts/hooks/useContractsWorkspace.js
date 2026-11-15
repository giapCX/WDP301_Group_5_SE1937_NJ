import { useEffect, useState } from 'react';
import { getContractCandidates, getContracts, prepareContract } from '../api/contractsApi';
import { getSessionToken } from '../../auth/session';

export default function useContractsWorkspace({ type, view, canPrepare, queue }) {
  const [rows, setRows] = useState([]), [candidates, setCandidates] = useState([]);
  const [page, setPage] = useState(1), [limit, setLimit] = useState(10), [pagination, setPagination] = useState(null);
  const [query, setQuery] = useState(''), [searchText, setSearchText] = useState(''), [status, setStatus] = useState('all');
  const [candidatePage, setCandidatePage] = useState(1), [candidateMeta, setCandidateMeta] = useState(null);
  const [reference, setReference] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState('');
  const [terms, setTerms] = useState({ commissionRatePct: '', place: '', garage: '', platformName: '' });
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selected, setSelected] = useState(null), [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    if (!getSessionToken()) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError('');
    const params = new URLSearchParams({ view, page: String(page), limit: String(limit) });
    if (query.trim()) params.set('q', query.trim());
    if (queue && type === 'rental') params.set('queue', queue);
    if (status !== 'all') params.set('status', status);
    getContracts(type, params, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setRows(result.data); setPagination(result.pagination); setPage(result.pagination.page); } })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, view, page, limit, revision, query, status, queue]);
  useEffect(() => {
    if (!canPrepare) return;
    const controller = new AbortController(); setReference(''); setCandidates([]); setCandidateMeta(null);
    getContractCandidates(type, candidatePage, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setCandidates(result.data); setCandidateMeta(result.pagination); setCandidatePage(result.pagination.page); } })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [type, canPrepare, candidatePage, revision]);
  async function prepare(event) {
    event.preventDefault(); if (!reference || busy) return;
    setBusy(true); setError('');
    try {
      const managementFields = type === 'management' ? {
        ...(start ? { startDate: start } : {}), ...(end ? { endDate: end } : {}),
        ...(terms.commissionRatePct !== '' ? { commissionRatePct: Number(terms.commissionRatePct) } : {}),
        ...Object.fromEntries(['place', 'garage', 'platformName'].filter((key) => terms[key].trim()).map((key) => [key, terms[key]])),
      } : {};
      const result = await prepareContract(type, reference, managementFields);
      setSelected(result.data); refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  return { rows, candidates, page, setPage, limit, setLimit, pagination, query, setQuery, searchText, setSearchText, status, setStatus, candidatePage, setCandidatePage, candidateMeta, reference, setReference, start, setStart, end, setEnd, terms, setTerms, loading, busy, error, setError, selected, setSelected, refresh, prepare };
}
