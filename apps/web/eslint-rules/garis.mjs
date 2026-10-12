// The design-system rules for the redesign's code (SPEC story 150): new folders use only the Garis tokens, type
// styles and icons. eslint.config.js applies them to the folders in GARIS_FILES; C1 makes them global.
// tests/garis-lint.test.mjs checks each rule on good and bad samples.

const COLOUR_UTILITY =
  /^(?:[\w@[\]&>:*-]+:)*!?-?(bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|divide|decoration|placeholder|caret|accent|shadow)-(.+?)!?$/;
// Colour names that aren't Garis tokens: Tailwind's palette and the old screens' palette.
const FOREIGN_COLOUR =
  /^(?:black|white|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|primary|secondary|destructive|background|foreground|popover|card|input|info|warning|error|ring|border)(?:-|$)|^(?:muted|accent)-foreground$|^success-\d/;
const ARBITRARY_COLOUR = /^\[.*(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color-mix\(|var\(--).*\]$/i;
const RAW_COLOUR = /(?:^|[^\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|hwb|color-mix)\(/i;

const TEXT_SIZE_CLASS = /^(?:[\w@[\]&>:*-]+:)*!?text-(?:xs|sm|base|lg|xl|[2-9]xl|(?:heading|body)-[a-z]+|\[[^\]]+\])(?:\/[\w.[\]-]+)?!?$/;
const ARBITRARY_SIZE_VALUE = /^text-\[(?:length:)?[\d.]+(?:px|rem|em|vw|vh|%)?\]|^text-\[(?:calc|clamp|min|max)\(/;
const MONO = /\bfont-mono\b|\bmonospace\b|(?:Geist|Roboto|JetBrains|IBM Plex|Fira|Source Code|Ubuntu|DM|Space|Noto Sans) Mono\b|Fira Code|Courier|Menlo|Consolas|SFMono/i;
export const ICON_LIBRARIES = [
  'lucide-react',
  'lucide',
  'react-icons',
  '@radix-ui/react-icons',
  '@heroicons/react',
  '@tabler/icons-react',
  '@phosphor-icons/react',
  'phosphor-react',
  '@fortawesome/react-fontawesome',
  'react-feather',
  '@mui/icons-material',
  'iconoir-react',
];

/** Every string the file holds: literals and template parts (class lists live in className, cn(), cva). */
function onStrings(context, check) {
  return {
    Literal(node) {
      if (typeof node.value === 'string') check(node, node.value);
    },
    TemplateElement(node) {
      check(node, node.value.cooked ?? node.value.raw);
    },
  };
}

const tokens = (text) => text.split(/\s+/).filter(Boolean);

const noRawColour = {
  meta: {
    type: 'problem',
    docs: { description: 'Colours come only from the Garis tokens (bg-surface, text-fg-2, border-line, …).' },
    messages: {
      raw: 'Raw colour value "{{value}}": use a Garis token class or var(--token) in the design-system CSS.',
      foreign: 'Colour class "{{value}}" isn\'t a Garis token: use bg-*, text-fg*, border-line and the other token classes.',
    },
    schema: [],
  },
  create(context) {
    return onStrings(context, (node, text) => {
      const raw = RAW_COLOUR.exec(text);
      if (raw) {
        context.report({ node, messageId: 'raw', data: { value: raw[0].trim() } });
        return;
      }
      for (const t of tokens(text)) {
        const m = COLOUR_UTILITY.exec(t);
        if (!m) continue;
        const value = m[2].replace(/\/[\w.[\]]+$/, '');
        if (m[1] === 'text' && /^(?:left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/.test(value)) continue;
        if (FOREIGN_COLOUR.test(value) || ARBITRARY_COLOUR.test(value))
          context.report({ node, messageId: 'foreign', data: { value: t } });
      }
    });
  },
};

const noArbitraryTextSize = {
  meta: {
    type: 'problem',
    docs: { description: 'Text sizes come only from the Garis type styles (t-display, t-title, t-sm, …).' },
    messages: { size: 'Text size "{{value}}": use a Garis type style (t-display-l … t-micro, t-figure).' },
    schema: [],
  },
  create(context) {
    return onStrings(context, (node, text) => {
      for (const t of tokens(text)) {
        const bare = t.replace(/^(?:[\w@[\]&>:*-]+:)*!?/, '');
        if (!TEXT_SIZE_CLASS.test(t)) continue;
        // text-[…] is a size only when it holds a length; text-[var(--x)] and colours are the colour rule's.
        if (bare.startsWith('text-[') && !ARBITRARY_SIZE_VALUE.test(bare)) continue;
        context.report({ node, messageId: 'size', data: { value: t } });
      }
    });
  },
};

const noTransitionAll = {
  meta: {
    type: 'problem',
    docs: { description: 'Transitions name their properties (SPEC "Motion").' },
    messages: { all: 'transition-all animates layout too: name the properties (transition-colors, …).' },
    schema: [],
  },
  create(context) {
    return onStrings(context, (node, text) => {
      if (/(?:^|[\s:])transition-all(?!\S)|transition(?:-property)?\s*:\s*all\b/.test(text))
        context.report({ node, messageId: 'all' });
    });
  },
};

const noImgIcon = {
  meta: {
    type: 'problem',
    docs: { description: 'Icons are Garis icon components; images go through Media; the logo through HmifLogo.' },
    messages: {
      img: '<img> here: use a Garis icon component, HmifLogo for the logo, or Media for a picture.',
    },
    schema: [{ type: 'object', properties: { allow: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }],
  },
  create(context) {
    const allow = context.options[0]?.allow ?? [];
    const file = context.filename.replace(/\\/g, '/');
    if (allow.some((a) => file.endsWith(a))) return {};
    return {
      JSXOpeningElement(node) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'img') context.report({ node, messageId: 'img' });
      },
    };
  },
};

const noIconLibrary = {
  meta: {
    type: 'problem',
    docs: { description: 'No icon libraries: the Garis set only (SPEC "Icons").' },
    messages: { lib: '"{{source}}" is an icon library: use the Garis icons in ~/components/icons.' },
    schema: [],
  },
  create(context) {
    const check = (node, source) => {
      if (typeof source !== 'string') return;
      if (ICON_LIBRARIES.some((l) => source === l || source.startsWith(`${l}/`)))
        context.report({ node, messageId: 'lib', data: { source } });
    };
    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => node.source.type === 'Literal' && check(node, node.source.value),
      ExportNamedDeclaration: (node) => node.source && check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
    };
  },
};

const noMonospace = {
  meta: {
    type: 'problem',
    docs: { description: 'No monospace: NIMs, codes and times use Geist with tabular figures (num).' },
    messages: { mono: 'Monospace ("{{value}}"): use Geist with tabular figures (the num or code style).' },
    schema: [],
  },
  create(context) {
    return onStrings(context, (node, text) => {
      const m = MONO.exec(text);
      if (m) context.report({ node, messageId: 'mono', data: { value: m[0] } });
    });
  },
};

export default {
  meta: { name: 'garis' },
  rules: {
    'no-raw-colour': noRawColour,
    'no-arbitrary-text-size': noArbitraryTextSize,
    'no-transition-all': noTransitionAll,
    'no-img-icon': noImgIcon,
    'no-icon-library': noIconLibrary,
    'no-monospace': noMonospace,
  },
};
