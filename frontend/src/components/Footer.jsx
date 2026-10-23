import { Logo } from "./Logo";

export default function Footer() {
  return (
    <footer className="mt-6 border-t border-slate-200/80 bg-[#f5f7fb]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Logo className="h-7" />
          <span className="h-5 w-px bg-slate-200" />
          <p className="text-xs font-medium text-slate-500 tracking-wide uppercase">
            AI • Software • Technology
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <a href="https://www.veritech-ai.com" target="_blank" rel="noreferrer" className="font-semibold text-slate-700 hover:text-blue-600 transition-colors">www.veritech-ai.com</a>
          <a href="mailto:info@veritech-ai.com" className="font-semibold text-slate-700 hover:text-blue-600 transition-colors">info@veritech-ai.com</a>
          <a href="#" className="hover:text-slate-900 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-slate-900 transition-colors">Terms &amp; Conditions</a>
          <a href="#" className="hover:text-slate-900 transition-colors">Refund Policy</a>
          <a href="#" className="hover:text-slate-900 transition-colors">Contact</a>
        </div>
        <p className="text-xs text-slate-400">© 2026 Veritech.AI. All rights reserved.</p>
      </div>
    </footer>
  );
}
