import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';

// Load fonts from @fontsource packages at build time. Satori reads woff (not
// woff2) and can't use variable fonts, so the images use the static cuts of
// Schibsted Grotesk, the site's own face (served as a variable woff2).
const nodeModules = path.join(process.cwd(), 'node_modules');
const schibsted = (weight: number) =>
  fs.readFileSync(
    path.join(nodeModules, `@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-${weight}-normal.woff`)
  );
const schibsted400 = schibsted(400);
const schibsted500 = schibsted(500);
const schibsted600 = schibsted(600);
const schibsted700 = schibsted(700);

export interface OgImageProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge?: string;
}

const CREAM = '#F5F0E8';
const INK = '#1F2319';
const FOREST = '#1A5C12';
const STONE = '#D6D1C8';

function tpl({ eyebrow, title, subtitle, badge }: OgImageProps) {
  return {
    type: 'div',
    props: {
      style: {
        width: '1200px',
        height: '630px',
        background: CREAM,
        display: 'flex',
        flexDirection: 'column',
        padding: '72px 80px',
        position: 'relative',
        fontFamily: 'Schibsted Grotesk',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: '-200px',
              left: '-120px',
              width: '700px',
              height: '700px',
              borderRadius: '50%',
              background: 'rgba(26, 92, 18, 0.10)',
              filter: 'blur(60px)',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '28px',
                    fontWeight: 700,
                    letterSpacing: '-0.5px',
                    color: INK,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  },
                  children: [
                    // The diamond is drawn, not typed: the font has no U+25C6.
                    { type: 'div', props: { style: { width: '15px', height: '15px', background: FOREST, transform: 'rotate(45deg)' } } },
                    'OakFox',
                  ],
                },
              },
              badge
                ? {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: '14px',
                        fontWeight: 500,
                        letterSpacing: '2px',
                        textTransform: 'uppercase',
                        color: FOREST,
                        border: `1px solid ${FOREST}`,
                        borderRadius: '999px',
                        padding: '8px 18px',
                      },
                      children: badge,
                    },
                  }
                : null,
            ].filter(Boolean),
          },
        },
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              position: 'relative',
              paddingTop: '40px',
            },
            children: [
              eyebrow
                ? {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: '15px',
                        fontWeight: 500,
                        letterSpacing: '3px',
                        textTransform: 'uppercase',
                        color: FOREST,
                        marginBottom: '28px',
                      },
                      children: eyebrow,
                    },
                  }
                : null,
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: title.length > 80 ? '54px' : title.length > 50 ? '64px' : '76px',
                    fontWeight: 600,
                    letterSpacing: '-1.5px',
                    color: INK,
                    lineHeight: 1.05,
                    maxWidth: '1000px',
                  },
                  children: title,
                },
              },
              subtitle
                ? {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: '22px',
                        color: 'rgba(31, 35, 25, 0.65)',
                        marginTop: '28px',
                        maxWidth: '900px',
                        lineHeight: 1.4,
                      },
                      children: subtitle,
                    },
                  }
                : null,
            ].filter(Boolean),
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: `1px solid ${STONE}`,
              paddingTop: '28px',
              position: 'relative',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '16px',
                    color: 'rgba(31, 35, 25, 0.55)',
                  },
                  children: 'Sustainable design studio · West Lancashire, UK',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '16px',
                    fontWeight: 500,
                    color: FOREST,
                  },
                  children: 'oakfox.co.uk',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

// Schibsted Grotesk has no subscript digits, so CO₂ is written CO2 here.
const plain = (s?: string) => s?.replace(/₂/g, '2');

// At 22px the subtitle runs about 75 characters a line. A title over 50
// characters takes three lines, which leaves room for two subtitle lines, not
// three, before the footer rule; cut at a word and end with an ellipsis.
const fit = (s: string | undefined, max: number) =>
  !s || s.length <= max ? s : s.slice(0, s.lastIndexOf(' ', max - 1)).replace(/[\s,;:.]+$/, '') + '…';

export async function renderOgPng(props: OgImageProps): Promise<Buffer> {
  const subtitle = fit(plain(props.subtitle), props.title.length > 50 ? 150 : 225);
  const text = { ...props, eyebrow: plain(props.eyebrow), title: plain(props.title)!, subtitle, badge: plain(props.badge) };
  const svg = await satori(tpl(text) as any, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Schibsted Grotesk', data: schibsted400, weight: 400, style: 'normal' },
      { name: 'Schibsted Grotesk', data: schibsted500, weight: 500, style: 'normal' },
      { name: 'Schibsted Grotesk', data: schibsted600, weight: 600, style: 'normal' },
      { name: 'Schibsted Grotesk', data: schibsted700, weight: 700, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  });
  return resvg.render().asPng();
}
