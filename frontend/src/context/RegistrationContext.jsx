import { createContext, useContext, useEffect, useState } from "react";

const KEY = "veritech_registration_state";
const Ctx = createContext(null);

export function RegistrationProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const update = (patch) => setState((s) => ({ ...s, ...patch }));
  const reset = () => { localStorage.removeItem(KEY); setState({}); };
  return <Ctx.Provider value={{ state, update, reset }}>{children}</Ctx.Provider>;
}

export const useRegistration = () => useContext(Ctx);
