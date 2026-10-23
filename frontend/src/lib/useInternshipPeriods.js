import { useEffect, useState } from "react";
import { api } from "./api";

let cachedPeriods = null;
let inflight = null;

function fetchPeriods() {
  if (cachedPeriods) return Promise.resolve(cachedPeriods);
  if (inflight) return inflight;
  inflight = api
    .get("/internship-periods")
    .then((response) => {
      cachedPeriods = response.data.periods || {};
      return cachedPeriods;
    })
    .catch(() => {
      cachedPeriods = cachedPeriods || {};
      return cachedPeriods;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export default function useInternshipPeriods() {
  const [periods, setPeriods] = useState(cachedPeriods || {});
  useEffect(() => {
    let alive = true;
    fetchPeriods().then((value) => {
      if (alive) setPeriods(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return periods;
}
