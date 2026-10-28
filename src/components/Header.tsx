import { NavLink } from 'react-router';
import { SITE_NAME } from '../lib/usePageMeta';
import styles from './Header.module.css';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About', end: false },
  { to: '/projects', label: 'Projects', end: false },
  { to: '/contact', label: 'Contact', end: false },
] as const;

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <NavLink to="/" className={styles.brand}>
          {SITE_NAME}
        </NavLink>
        <nav aria-label="Primary">
          <ul className={styles.list}>
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => (isActive ? styles.active : styles.link)}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
