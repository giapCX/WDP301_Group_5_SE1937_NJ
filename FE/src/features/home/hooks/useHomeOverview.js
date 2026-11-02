import { useEffect, useState } from 'react';
import { getHomepage } from '../api/homeApi';
import { getListings } from '../../listings/api/listingApi';

export default function useHomeOverview() {
  const [homepage, setHomepage] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [metaError, setMetaError] = useState(false);
  const [metaRetry, setMetaRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setMetaError(false);
    Promise.allSettled([
      getHomepage({ signal: controller.signal }),
      getListings({ limit: 100 }, { signal: controller.signal }),
    ]).then(([meta, cars]) => {
      if (controller.signal.aborted) return;
      if (meta.status === 'fulfilled') setHomepage(meta.value.data);
      else setMetaError(true);
      if (cars.status === 'fulfilled') setCatalog(cars.value.data);
    });
    return () => controller.abort();
  }, [metaRetry]);


  return { homepage, catalog, metaError, setMetaRetry };
}
