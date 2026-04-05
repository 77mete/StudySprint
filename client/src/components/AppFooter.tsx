export const AppFooter = () => {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/90 px-4 py-8 text-center text-xs text-slate-500">
      <p className="text-slate-400">
        StudySprint — odaklı çalışma seansları için basit bir araçtır. Ticari bir ürün değildir;
        kullanım kendi sorumluluğunuzdadır.
      </p>
      <p className="mt-3">
        Created by{' '}
        <a
          href="https://github.com/77mete?tab=repositories"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-400 underline-offset-2 hover:text-brand-300 hover:underline"
        >
          Mete
        </a>
      </p>
      <p className="mt-2 text-slate-600">© {new Date().getFullYear()} StudySprint</p>
    </footer>
  )
}
