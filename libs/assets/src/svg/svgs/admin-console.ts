import { svg } from "../svg";

const AdminConsoleLogo = svg`
<svg version="1.1" viewBox="0 0 260 56" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="KyVault Admin">
  <title>KyVault Admin</title>
  <rect x="2" y="2" width="52" height="52" rx="14" fill="var(--accent, #bf3f18)"/>
  <circle cx="28" cy="28" r="16" fill="none" stroke="var(--button-text, #ffffff)" stroke-width="3.2"/>
  <circle cx="28" cy="25" r="4.5" fill="var(--button-text, #ffffff)"/>
  <path d="M25.5 28.5h5l1.4 9.5h-7.8l1.4-9.5z" fill="var(--button-text, #ffffff)"/>
  <text x="66" y="31" fill="var(--ink-strong, currentColor)" font-family="'Space Grotesk', ui-sans-serif, system-ui, sans-serif" font-size="26" font-weight="700" letter-spacing="-0.025em">KyVault</text>
  <text x="66" y="48" fill="var(--ink, currentColor)" font-family="'Space Grotesk', ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="600" letter-spacing="0.01em">Admin Console</text>
</svg>
`;

export default AdminConsoleLogo;
