import { Home, Info, LayoutGrid, PieChart, Code2 } from 'lucide-react';

const navItems = [
  { icon: Home, label: 'Home', target: '#top' },
  { icon: Info, label: 'About', target: '#about' },
  { icon: LayoutGrid, label: 'Features', target: '#features' },
  { icon: PieChart, label: 'Tokenomics', target: '#tokenomics' },
  { icon: Code2, label: 'Dev Docs', target: '/docs' },
];

const SideNav = () => {
  const handleClick = (target: string) => {
    if (target.startsWith('/')) {
      window.location.href = target;
    } else if (target === '#top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <aside className="hidden lg:block fixed left-6 top-1/2 -translate-y-1/2 z-30">
      <div className="flex flex-col gap-2 bg-background border border-border rounded-full p-2 shadow-lg items-center">
        {navItems.map(({ icon: Icon, label, target }) => (
          <button
            key={label}
            onClick={() => handleClick(target)}
            className="group grid place-items-center hover:text-primary hover:bg-secondary transition relative text-muted-foreground w-10 h-10 rounded-full cursor-pointer"
          >
            <Icon size={18} />
            <span className="absolute left-12 bg-primary text-primary-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-mono">
              {label}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
};

export default SideNav;
