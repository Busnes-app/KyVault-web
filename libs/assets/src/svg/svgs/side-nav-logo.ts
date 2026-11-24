import { svg } from "../svg";

const SideNavLogo = svg`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 144 32" role="img" aria-label="KyVault">
  <title>KyVault</title>
  <rect x="0" y="2" width="28" height="28" rx="8" fill="var(--accent, #bf3f18)"/>
  <circle cx="14" cy="16" r="8.5" fill="none" stroke="var(--button-text, #ffffff)" stroke-width="2"/>
  <circle cx="14" cy="14.2" r="2.3" fill="var(--button-text, #ffffff)"/>
  <path d="M12.6 16.2h2.8l.8 5.2h-4.4l.8-5.2z" fill="var(--button-text, #ffffff)"/>
  <text x="38" y="22.5" fill="var(--ink-strong, currentColor)" font-family="'Space Grotesk', ui-sans-serif, system-ui, sans-serif" font-size="19" font-weight="700" letter-spacing="-0.02em">KyVault</text>
</svg>
`;

export { SideNavLogo };
