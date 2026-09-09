import { Accordion } from './Accordion';
import type { FAQ_ITEMS } from '../content/site';

type FaqProps = {
  items: typeof FAQ_ITEMS;
};

export function Faq({ items }: FaqProps) {
  return (
    <div>
      {items.map((item) => (
        <Accordion key={item.q} title={item.q}>
          <p style={{ margin: 0 }}>{item.a}</p>
        </Accordion>
      ))}
    </div>
  );
}
