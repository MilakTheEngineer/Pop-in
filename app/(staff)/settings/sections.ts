export const shopSections=['shop','directory','hours','services','team','salon','rules','reminders'] as const;
export const systemSections=['integrations','billing','import','appearance'] as const;
export function isShopSection(section:string){return (shopSections as readonly string[]).includes(section)}
