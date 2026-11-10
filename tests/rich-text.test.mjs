import { test } from 'node:test';
import assert from 'node:assert/strict';
import { richText, buildTermIndex } from '../js/ui/rich-text.js';

const glossary = [
  { term: 'On Play', aliases: [], short: 'x' },
  { term: 'Activate: Main', aliases: ['Activate:Main'], short: 'x' },
  { term: 'DON!! xN', aliases: ['DON!! x1', 'DON!! x2'], short: 'x', pattern: 'DON!! x\\d+' },
  { term: 'DON!! −N', aliases: [], short: 'x', pattern: 'DON!! ?[−-]\\d+' },
  { term: 'Trait', aliases: ['Type'], short: 'x' },
];
const idx = buildTermIndex(glossary);

test('bracketed keyword becomes a tappable term button', () => {
  const html = richText('[On Play] Draw 1 card.', idx);
  assert.match(html, /<button[^>]*class="kw"[^>]*data-term="On Play"[^>]*>\[On Play\]<\/button> Draw 1 card\./);
});
test('aliases map to the main term', () => {
  assert.match(richText('[Activate:Main] Rest this.', idx), /data-term="Activate: Main"/);
  assert.match(richText('[DON!! x2] This gains +1000.', idx), /data-term="DON!! xN"/);
});
test('unbracketed DON!! minus cost is recognized', () => {
  assert.match(richText('DON!! -1 (You may return…): K.O. up to 1.', idx), /data-term="DON!! −N"[^>]*>DON!! -1</);
});
test('html in card text is escaped', () => {
  const html = richText('<script>alert(1)</script> [On Play]', idx);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});
test('unknown brackets stay as plain escaped text', () => {
  assert.equal(richText('Play [Monkey.D.Luffy].', idx), 'Play [Monkey.D.Luffy].');
});
test('{Type} references render as trait chips linked to the Trait term', () => {
  assert.match(richText('Up to 1 {Straw Hat Crew} card', idx), /<button[^>]*class="kw kw-trait"[^>]*data-term="Trait"[^>]*>Straw Hat Crew<\/button>/);
});
test('newlines become line breaks', () => {
  assert.equal(richText('a\nb', idx), 'a<br>b');
});

test('displayName strips the disambiguation suffix from card names', async () => {
  const { displayName } = await import('../js/ui/define.js');
  assert.equal(displayName('Monkey.D.Luffy (001)'), 'Monkey.D.Luffy');
  assert.equal(displayName('Roronoa Zoro (ST32-005)'), 'Roronoa Zoro');
  assert.equal(displayName('Nami'), 'Nami');
  assert.equal(displayName('Ms. All Sunday (OP1)'), 'Ms. All Sunday');
});
