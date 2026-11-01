// Admin panel (src/pages/admin/index.astro). Everything is built with DOM nodes and textContent,
// never innerHTML, because comments and other data shown here come from visitors.
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';

type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown>;
type Lang = 'en' | 'es' | 'fr';
type Collection = 'blog' | 'projects';
type Entry = { data: Record<string, unknown>; body: string };
type Session = { needsSetup: boolean; signedIn: boolean; username?: string; passkeys?: number };

const app = document.getElementById('app')!;
const LANGS: Lang[] = ['en', 'es', 'fr'];
const LANG_NAMES: Record<Lang, string> = { en: 'English', es: 'Español', fr: 'Français' };
const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

// ---------- DOM helpers ----------
function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    else if (key === 'class') el.className = String(value);
    else if (key === 'value') (el as HTMLInputElement).value = String(value);
    else if (key === 'checked') (el as HTMLInputElement).checked = Boolean(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}
function append(parent: Node, children: Child[]) {
  for (const child of children.flat(Infinity as 1) as Child[]) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}
const mount = (target: HTMLElement, ...children: Child[]) => {
  target.replaceChildren();
  append(target, children);
};
const field = (label: string, control: HTMLElement, hint?: string) =>
  h('label', { class: 'field' }, h('span', {}, label), control, hint && h('small', {}, hint));
const check = (label: string, control: HTMLElement) => h('label', { class: 'check' }, control, label);
const formatDate = (value: string) => {
  // Resend sends "2026-11-01 09:02:51.25+00"; make it ISO before parsing
  const date = new Date(value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ---------- API ----------
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Wrong username or password.',
  rate_limited: 'Too many attempts. Wait 15 minutes and try again.',
  invalid_setup_token: 'That setup token is not right.',
  weak_password: 'Use a password of at least 12 characters.',
  invalid_username: 'Username: 3–40 lowercase letters, numbers, dots, dashes or underscores.',
  setup_disabled: 'COMMENTS_ADMIN_TOKEN (32+ characters) is missing in Vercel.',
  not_configured: 'This needs configuring in Vercel first.',
  no_passkeys: 'No passkey yet. Sign in with your password, then add one under Security.',
  passkey_failed: 'The passkey could not be verified.',
  challenge_expired: 'That took too long. Please try again.',
  not_verified: 'The passkey could not be verified.',
  unknown_passkey: 'This passkey is not registered here.',
  slug_taken: 'Another entry already uses this URL name.',
  invalid_slug: 'URL name: lowercase letters, numbers and dashes only.',
  missing_title_or_date: 'The English title and the date are required.',
  image_too_large: 'Images must be under 3 MB.',
  invalid_image_type: 'Use a PNG, JPG, WebP, GIF or AVIF image.',
  provider_error: "Resend didn't answer. Please try again.",
  forbidden: 'This request was refused.',
};
class ApiError extends Error {}
const describe = (error: unknown) =>
  error instanceof ApiError ? MESSAGES[error.message] ?? 'Something went wrong. Please try again.' :
  error instanceof Error && error.name === 'NotAllowedError' ? 'Cancelled.' :
  'Something went wrong. Please try again.';

async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith('session') && !path.startsWith('passkey')) {
    session = { needsSetup: false, signedIn: false };
    render();
  }
  if (!response.ok) throw new ApiError(data.error ?? 'server_error');
  return data as T;
}

// ---------- state & routing ----------
let session: Session | null = null;
let pendingCount = 0;
let dirty = false; // unsaved editor changes
let lastHash = location.hash;

window.addEventListener('hashchange', () => {
  if (dirty && !confirm('You have unsaved changes. Leave anyway?')) {
    history.replaceState(null, '', lastHash);
    return;
  }
  dirty = false;
  lastHash = location.hash;
  render();
});
window.addEventListener('beforeunload', event => { if (dirty) event.preventDefault(); });

async function boot() {
  try {
    session = await api<Session>('session');
  } catch (error) {
    mount(app, h('p', { class: 'admin-loading' }, describe(error)));
    return;
  }
  render();
}

function render() {
  if (!session) return;
  if (session.needsSetup) return setupView();
  if (!session.signedIn) return loginView();
  shell();
}

// ---------- setup & sign-in ----------
function authFrame(title: Child, hint: string, ...content: Child[]) {
  mount(app, h('div', { class: 'auth' },
    h('div', { class: 'auth__brand' }, 'Aymane', h('span', {}, '.')),
    h('h1', {}, title),
    h('p', { class: 'hint' }, hint),
    ...content,
  ));
}

function setupView() {
  const status = h('p', { class: 'status' });
  const token = h('input', { type: 'password', autocomplete: 'off', required: true });
  const username = h('input', { autocomplete: 'username', required: true, value: 'aymane' }) as HTMLInputElement;
  const password = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: 12 }) as HTMLInputElement;
  const confirmPw = h('input', { type: 'password', autocomplete: 'new-password', required: true }) as HTMLInputElement;
  const submit = h('button', { class: 'a-btn', type: 'submit' }, 'Create account');
  const form = h('form', {
    onsubmit: async (event: Event) => {
      event.preventDefault();
      if (password.value !== confirmPw.value) return void (status.textContent = "The passwords don't match.");
      submit.setAttribute('disabled', '');
      try {
        await api('session', { action: 'setup', setupToken: (token as HTMLInputElement).value, username: username.value, password: password.value });
        session = await api<Session>('session');
        location.hash = '#/security';
        render();
      } catch (error) {
        status.textContent = describe(error);
      } finally {
        submit.removeAttribute('disabled');
      }
    },
  },
    field('Setup token', token, 'Your COMMENTS_ADMIN_TOKEN from Vercel. Only needed this once.'),
    field('Username', username),
    field('Password', password, 'At least 12 characters.'),
    field('Repeat password', confirmPw),
    submit, status,
  );
  authFrame(['Create your ', h('em', {}, 'account')], 'This works only once: after your account exists, sign-up closes.', form);
}

function loginView() {
  const status = h('p', { class: 'status' });
  const username = h('input', { autocomplete: 'username webauthn', required: true }) as HTMLInputElement;
  const password = h('input', { type: 'password', autocomplete: 'current-password', required: true }) as HTMLInputElement;
  const submit = h('button', { class: 'a-btn', type: 'submit' }, 'Sign in');
  const signedIn = async () => {
    session = await api<Session>('session');
    render();
  };
  const form = h('form', {
    onsubmit: async (event: Event) => {
      event.preventDefault();
      submit.setAttribute('disabled', '');
      status.textContent = '';
      try {
        await api('session', { action: 'login', username: username.value, password: password.value });
        await signedIn();
      } catch (error) {
        status.textContent = describe(error);
        submit.removeAttribute('disabled');
      }
    },
  }, field('Username', username), field('Password', password), submit);

  const passkey = browserSupportsWebAuthn() && h('button', {
    class: 'a-btn a-btn--ghost',
    type: 'button',
    style: 'width: 100%',
    onclick: async () => {
      status.textContent = '';
      try {
        const optionsJSON = await api('passkey', { action: 'login-options' });
        const response = await startAuthentication({ optionsJSON });
        await api('passkey', { action: 'login-verify', response });
        await signedIn();
      } catch (error) {
        status.textContent = describe(error);
      }
    },
  }, 'Sign in with a passkey');

  authFrame(['Welcome ', h('em', {}, 'back')], 'Sign in to manage comments, subscribers, posts and projects.',
    form, passkey && h('p', { class: 'auth__or' }, 'or'), passkey, h('div', { style: 'margin-top: 14px' }, status));
}

// ---------- shell ----------
const NAV = [
  ['#/', 'Dashboard'],
  ['#/comments', 'Comments'],
  ['#/newsletter', 'Newsletter'],
  ['#/posts', 'Posts'],
  ['#/projects', 'Projects'],
  ['#/security', 'Security'],
] as const;

function shell() {
  const route = location.hash.replace(/^#/, '') || '/';
  const section = '/' + (route.split('/')[1] ?? '');
  const main = h('main', { class: 'main' });
  const nav = h('nav', {}, NAV.map(([href, label]) => h('a', {
    href,
    class: section === href.slice(1) ? 'active' : '',
  }, label, href === '#/comments' && pendingCount > 0 && h('span', { class: 'badge' }, pendingCount))));

  mount(app, h('div', { class: 'shell' },
    h('aside', { class: 'side' },
      h('div', { class: 'side__brand' }, 'Aymane', h('span', {}, '.'), h('small', {}, 'Admin')),
      nav,
      h('div', { class: 'side__foot' },
        h('a', { href: '/', target: '_blank', rel: 'noopener' }, 'View site ↗'),
        h('span', { class: 'muted' }, session?.username),
        h('button', {
          type: 'button',
          onclick: async () => {
            await api('session', { action: 'logout' }).catch(() => {});
            session = { needsSetup: false, signedIn: false };
            render();
          },
        }, 'Sign out'),
      ),
    ),
    main,
  ));

  const [, first, second] = route.split('/');
  const view =
    first === 'comments' ? commentsView :
    first === 'newsletter' ? newsletterView :
    first === 'posts' && second ? () => editorView(main, 'blog', second) :
    first === 'projects' && second ? () => editorView(main, 'projects', second) :
    first === 'posts' ? () => listView(main, 'blog') :
    first === 'projects' ? () => listView(main, 'projects') :
    first === 'security' ? securityView :
    dashboardView;
  mount(main, h('p', { class: 'muted' }, 'Loading…'));
  Promise.resolve(view(main)).catch(error => mount(main, h('p', { class: 'status' }, describe(error))));
}

const pageHead = (title: Child, subtitle?: Child, ...actions: Child[]) =>
  h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, title), subtitle && h('p', {}, subtitle)), h('div', { class: 'actions' }, actions));

function refreshBadge(count: number) {
  pendingCount = count;
  const link = app.querySelector('.side nav a[href="#/comments"]');
  if (!link) return;
  link.querySelector('.badge')?.remove();
  if (count > 0) link.appendChild(h('span', { class: 'badge' }, count));
}

// ---------- dashboard ----------
async function dashboardView(main: HTMLElement) {
  const settle = <T,>(promise: Promise<T>) => promise.then(value => ({ value }), () => ({ value: undefined }));
  const [comments, subscribers, posts, projects] = await Promise.all([
    settle(api('comments')), settle(api('subscribers')), settle(api('content?collection=blog')), settle(api('content?collection=projects')),
  ]);
  if (comments.value) refreshBadge(comments.value.pending.length);
  const tile = (href: string, value: number | undefined, label: string) =>
    h('a', { class: 'tile', href }, h('b', {}, value ?? '—'), h('span', {}, label));
  mount(main,
    pageHead(['Hello, ', h('em', {}, session?.username ?? '')], 'Everything on your site, in one place.'),
    h('div', { class: 'tiles' },
      tile('#/comments', comments.value?.pending.length, 'Comments to review'),
      tile('#/newsletter', subscribers.value?.subscribers.filter((s: any) => !s.unsubscribed).length, 'Subscribers'),
      tile('#/posts', posts.value?.items.length, 'Posts'),
      tile('#/projects', projects.value?.items.length, 'Projects'),
    ),
    h('h2', { class: 'section-title' }, 'Quick actions'),
    h('div', { class: 'actions' },
      h('a', { class: 'a-btn', href: '#/posts/new' }, 'Write a post'),
      h('a', { class: 'a-btn a-btn--ghost', href: '#/projects/new' }, 'Add a project'),
      h('a', { class: 'a-btn a-btn--ghost', href: 'https://resend.com/broadcasts', target: '_blank', rel: 'noopener' }, 'Send a newsletter ↗'),
    ),
  );
}

// ---------- comments ----------
async function commentsView(main: HTMLElement) {
  const { pending, approved } = await api<{ pending: any[]; approved: Record<string, any[]> }>('comments');
  refreshBadge(pending.length);
  const act = async (body: unknown) => {
    try {
      await api('comments', body);
      await commentsView(main);
    } catch (error) {
      alert(describe(error));
    }
  };
  const meta = (c: any) => h('div', { class: 'row__meta' }, h('strong', {}, c.name), formatDate(c.date), c.slug && h('a', { href: `/blog/${c.slug}`, target: '_blank', rel: 'noopener' }, c.slug));

  const approvedList = Object.entries(approved).filter(([, list]) => list.length);
  mount(main,
    pageHead(['Comments ', h('em', {}, 'to review')], 'New comments wait here until you approve them.'),
    pending.length ? pending.map(c => h('div', { class: 'comment-card' },
      meta(c),
      h('p', {}, c.message),
      h('div', { class: 'actions' },
        h('button', { class: 'a-btn a-btn--sm', onclick: () => act({ action: 'approve', id: c.id }) }, 'Approve'),
        h('button', { class: 'a-btn a-btn--sm a-btn--danger', onclick: () => act({ action: 'reject', id: c.id }) }, 'Reject'),
      ),
    )) : h('p', { class: 'empty' }, 'Nothing to review.'),
    h('h2', { class: 'section-title' }, 'Published'),
    approvedList.length ? approvedList.map(([slug, list]) => h('div', {},
      h('p', { class: 'muted', style: 'margin: 18px 0 8px' }, slug),
      h('div', { class: 'rows' }, list.map(c => h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'row__title' }, c.name), h('div', { class: 'row__meta' }, formatDate(c.date)), h('p', { style: 'margin-top: 6px; white-space: pre-wrap' }, c.message)),
        h('button', {
          class: 'a-btn a-btn--sm a-btn--danger',
          onclick: () => confirm('Delete this comment?') && act({ action: 'delete', slug, id: c.id }),
        }, 'Delete'),
      ))),
    )) : h('p', { class: 'empty' }, 'No published comments yet.'),
  );
}

// ---------- newsletter ----------
async function newsletterView(main: HTMLElement) {
  const { subscribers } = await api<{ subscribers: any[] }>('subscribers');
  const active = subscribers.filter(s => !s.unsubscribed);
  const exportCsv = () => {
    const csv = ['email,subscribed_at,unsubscribed', ...subscribers.map(s => `${s.email},${s.createdAt},${s.unsubscribed}`)].join('\n');
    const link = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'subscribers.csv' });
    link.click();
  };
  mount(main,
    pageHead(['Newsletter ', h('em', {}, 'subscribers')], `${active.length} subscribed · managed in Resend`,
      h('button', { class: 'a-btn a-btn--ghost', onclick: exportCsv, disabled: !subscribers.length }, 'Export CSV'),
      h('a', { class: 'a-btn', href: 'https://resend.com/broadcasts', target: '_blank', rel: 'noopener' }, 'Send a newsletter ↗'),
    ),
    subscribers.length ? h('div', { class: 'rows' }, subscribers.map(s => h('div', { class: 'row' },
      h('div', {}, h('div', { class: 'row__title' }, s.email),
        h('div', { class: 'row__meta' }, formatDate(s.createdAt), s.unsubscribed && h('span', { class: 'pill' }, 'Unsubscribed'))),
      h('button', {
        class: 'a-btn a-btn--sm a-btn--danger',
        onclick: async () => {
          if (!confirm(`Remove ${s.email} from your list?`)) return;
          try {
            await api('subscribers', { action: 'remove', id: s.id });
            await newsletterView(main);
          } catch (error) {
            alert(describe(error));
          }
        },
      }, 'Remove'),
    ))) : h('p', { class: 'empty' }, 'No subscribers yet.'),
  );
}

// ---------- posts & projects: list ----------
const NOUN = { blog: ['post', 'Posts', 'posts'], projects: ['project', 'Projects', 'projects'] } as const;

async function listView(main: HTMLElement, collection: Collection) {
  const [singular, plural, path] = NOUN[collection];
  const { items } = await api<{ items: any[] }>(`content?collection=${collection}`);
  mount(main,
    pageHead([plural, ' ', h('em', {}, `(${items.length})`)], 'Changes are saved to GitHub and go live after the site rebuilds (about a minute).',
      h('a', { class: 'a-btn', href: `#/${path}/new` }, `New ${singular}`)),
    items.length ? h('div', { class: 'rows' }, items.map(item => h('div', { class: 'row' },
      h('div', {},
        h('a', { class: 'row__title', href: `#/${path}/${item.slug}` }, item.title),
        h('div', { class: 'row__meta' },
          item.date,
          h('span', { class: item.draft ? 'pill' : 'pill pill--dark' }, item.draft ? 'Draft' : 'Published'),
          item.featured && h('span', { class: 'pill' }, 'Featured'),
          h('span', {}, item.langs.map((l: string) => l.toUpperCase()).join(' · ')),
        ),
      ),
      h('a', { class: 'a-btn a-btn--sm a-btn--ghost', href: `#/${path}/${item.slug}` }, 'Edit'),
    ))) : h('p', { class: 'empty' }, `No ${path} yet.`),
  );
}

// ---------- posts & projects: editor ----------
const today = () => new Date().toISOString().slice(0, 10);
const slugify = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const blank = (collection: Collection): Record<Lang, Entry> => ({
  en: {
    data: collection === 'blog'
      ? { title: '', date: today(), tag: '', excerpt: '', draft: true, signed: true }
      : { title: '', date: today(), type: 'analysis', tags: [], excerpt: '', icon: 'code', featured: false, draft: true },
    body: '',
  },
  es: { data: {}, body: '' },
  fr: { data: {}, body: '' },
});
// Drop empty strings and empty lists so optional fields fall back to their defaults
const clean = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== undefined && !(Array.isArray(v) && !v.length)));

async function readFileBase64(file: File) {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return url.slice(url.indexOf(',') + 1);
}
async function uploadImage(): Promise<string | null> {
  const input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif' }) as HTMLInputElement;
  const file = await new Promise<File | null>(resolve => {
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
  if (!file) return null;
  const { url } = await api<{ url: string }>('content', { action: 'upload', name: file.name, base64: await readFileBase64(file) });
  return url;
}

async function editorView(main: HTMLElement, collection: Collection, slugParam: string) {
  const [singular, , path] = NOUN[collection];
  const isNew = slugParam === 'new';
  const langs: Record<Lang, Entry> = isNew ? blank(collection) : (await api(`content?collection=${collection}&slug=${slugParam}`)).langs;
  for (const lang of LANGS) langs[lang] ??= { data: {}, body: '' };
  const en = langs.en.data;
  if (en.date) en.date = String(en.date).slice(0, 10);
  let slug = isNew ? '' : slugParam;
  let slugTouched = false;
  let tab: Lang = 'en';

  const status = h('p', { class: 'status' });
  const touch = () => { dirty = true; status.textContent = ''; };

  // Inputs bound to an object key
  const bind = (target: Record<string, unknown>, key: string, attrs: Attrs = {}, tag = 'input') => {
    const el = h(tag, { ...attrs, value: target[key] ?? '' }) as HTMLInputElement;
    el.addEventListener('input', () => { target[key] = el.value; touch(); });
    return el;
  };
  const bindCheck = (target: Record<string, unknown>, key: string) => {
    const el = h('input', { type: 'checkbox', checked: Boolean(target[key]) }) as HTMLInputElement;
    el.addEventListener('change', () => { target[key] = el.checked; touch(); });
    return el;
  };
  const bindSelect = (target: Record<string, unknown>, key: string, options: string[]) => {
    const el = h('select', {}, options.map(o => h('option', { value: o }, o))) as HTMLSelectElement;
    el.value = String(target[key] ?? options[0]);
    el.addEventListener('change', () => { target[key] = el.value; touch(); });
    return el;
  };
  // Editable list of small objects (project tags, stats)
  const listEditor = (target: Record<string, unknown>, key: string, columns: string[], accent = false) => {
    const rows = h('div', { class: 'list-rows' });
    const items = () => (target[key] as Record<string, unknown>[]) ?? (target[key] = []);
    const draw = () => mount(rows, items().map((item, i) => h('div', { class: 'list-row' },
      ...columns.map(col => {
        const input = h('input', { value: item[col] ?? '', placeholder: col }) as HTMLInputElement;
        input.addEventListener('input', () => { item[col] = input.value; touch(); });
        return input;
      }),
      h('div', { class: 'actions' },
        accent && check('Lead', (() => {
          const box = h('input', { type: 'checkbox', checked: Boolean(item.accent) }) as HTMLInputElement;
          box.addEventListener('change', () => { item.accent = box.checked; touch(); });
          return box;
        })()),
        h('button', { class: 'a-btn a-btn--sm a-btn--ghost', type: 'button', onclick: () => { items().splice(i, 1); touch(); draw(); } }, '×'),
      ),
    )));
    draw();
    return h('div', { class: 'list-rows' }, rows,
      h('button', { class: 'a-btn a-btn--sm a-btn--ghost', type: 'button', style: 'justify-self: start', onclick: () => { items().push({}); touch(); draw(); } }, '+ Add'));
  };

  // Settings shared by all languages (stored in the English file)
  const slugInput = h('input', { value: slug, placeholder: 'my-new-post', disabled: !isNew }) as HTMLInputElement;
  slugInput.addEventListener('input', () => { slug = slugify(slugInput.value); slugTouched = true; touch(); });
  const coverInput = collection === 'projects' ? bind(en, 'cover', { placeholder: '/images/…' }) : null;

  const shared = h('section', { class: 'panel' },
    h('h2', {}, 'Settings · all languages'),
    h('div', { class: 'grid2' },
      field('URL name', slugInput, isNew ? `/${collection === 'blog' ? 'blog' : 'projects'}/${'…'} · fills from the English title` : 'Fixed once published'),
      field('Date', bind(en, 'date', { type: 'date' })),
      collection === 'projects' && field('Type', bindSelect(en, 'type', ['analysis', 'app']), 'App: the card links to the live site'),
      collection === 'projects' && field('Icon', bindSelect(en, 'icon', ['code', 'signal', 'web', 'automation'])),
    ),
    collection === 'blog' && h('div', { class: 'grid2' },
      field('Code repository URL', bind(en, 'repoUrl', { type: 'url', placeholder: 'https://github.com/…' })),
      field('Notebook URL (Colab)', bind(en, 'colabUrl', { type: 'url', placeholder: 'https://colab.research.google.com/github/…' })),
    ),
    collection === 'projects' && h('div', { class: 'grid2' },
      field('Live site URL', bind(en, 'externalUrl', { type: 'url', placeholder: 'https://…' })),
      field('Code repository URL', bind(en, 'repoUrl', { type: 'url', placeholder: 'https://github.com/…' })),
      field('Notebook URL', bind(en, 'colabUrl', { type: 'url', placeholder: 'https://colab.research.google.com/…' })),
      field('Cover image', h('div', { class: 'actions', style: 'flex-wrap: nowrap' }, coverInput,
        h('button', {
          class: 'a-btn a-btn--sm a-btn--ghost', type: 'button',
          onclick: async () => {
            try {
              const url = await uploadImage();
              if (url && coverInput) { coverInput.value = url; en.cover = url; touch(); }
            } catch (error) { status.textContent = describe(error); }
          },
        }, 'Upload'))),
    ),
    collection === 'projects' && field('Tags', listEditor(en, 'tags', ['label'], true)),
    h('div', { class: 'actions', style: 'gap: 20px' },
      check('Draft (hidden from the site)', bindCheck(en, 'draft')),
      collection === 'blog' && check('Signed with my signature', bindCheck(en, 'signed')),
      collection === 'projects' && check('Featured on the home page', bindCheck(en, 'featured')),
    ),
  );

  // Per-language text
  const langArea = h('div', {});
  const tabs = h('div', { class: 'tabs' });
  const drawTabs = () => mount(tabs, LANGS.map(lang => h('button', {
    type: 'button',
    class: lang === tab ? 'active' : '',
    onclick: () => { tab = lang; drawTabs(); drawLang(); },
  }, LANG_NAMES[lang])));
  const drawLang = () => {
    const entry = langs[tab];
    const data = entry.data;
    const title = bind(data, 'title');
    if (tab === 'en' && isNew) {
      title.addEventListener('input', () => {
        if (!slugTouched) { slug = slugify(String(data.title ?? '')); slugInput.value = slug; }
      });
    }
    const body = h('textarea', { class: 'body-input', spellcheck: 'true' }) as HTMLTextAreaElement;
    body.value = entry.body;
    body.addEventListener('input', () => { entry.body = body.value; touch(); });
    const insert = (text: string) => {
      const { selectionStart: start, selectionEnd: end } = body;
      body.setRangeText(text, start, end, 'end');
      entry.body = body.value;
      body.focus();
      touch();
    };
    mount(langArea, h('section', { class: 'panel', style: 'border-top: none; border-radius: 0 0 var(--radius) var(--radius)' },
      tab !== 'en' && h('p', { class: 'muted', style: 'font-size: 14px' }, `Optional. Leave the ${LANG_NAMES[tab]} title empty to show the English version on that language's pages.`),
      field('Title', title),
      field(collection === 'blog' ? 'Summary (blog list and share card)' : 'Description (project card)', bind(data, 'excerpt', { rows: 3 }, 'textarea')),
      collection === 'blog' && field('Tag', bind(data, 'tag', { placeholder: 'Finance, AI, Research…' })),
      collection === 'projects' && field('Highlight numbers', listEditor(data, 'stats', ['value', 'label'])),
      h('div', { class: 'field' },
        h('span', {}, 'Text · Markdown'),
        h('div', { class: 'actions', style: 'margin-bottom: 4px' },
          h('button', { class: 'a-btn a-btn--sm a-btn--ghost', type: 'button', onclick: () => insert('\n## Heading\n') }, 'Heading'),
          h('button', { class: 'a-btn a-btn--sm a-btn--ghost', type: 'button', onclick: () => insert('**bold**') }, 'Bold'),
          h('button', { class: 'a-btn a-btn--sm a-btn--ghost', type: 'button', onclick: () => insert('[link text](https://)') }, 'Link'),
          h('button', { class: 'a-btn a-btn--sm a-btn--ghost', type: 'button', onclick: () => insert('$$\nE = mc^2\n$$') }, 'Equation'),
          h('button', {
            class: 'a-btn a-btn--sm a-btn--ghost', type: 'button',
            onclick: async () => {
              try {
                const url = await uploadImage();
                if (url) insert(`\n<figure>\n  <img src="${url}" alt="Describe the image" loading="lazy" />\n  <figcaption>Figure: caption</figcaption>\n</figure>\n`);
              } catch (error) { status.textContent = describe(error); }
            },
          }, 'Image'),
        ),
        body,
        h('small', {}, 'Markdown: ## for headings, **bold**, [link](url), $math$. Uploaded images appear on the live site after the next rebuild.'),
      ),
    ));
  };

  const save = h('button', { class: 'a-btn', type: 'button' }, isNew ? `Create ${singular}` : 'Save');
  save.addEventListener('click', async () => {
    if (!slug) return void (status.textContent = MESSAGES.invalid_slug);
    save.setAttribute('disabled', '');
    status.classList.remove('status--ok');
    status.textContent = 'Saving…';
    const payload = Object.fromEntries(LANGS.map(lang => {
      const { data, body } = langs[lang];
      const out = { ...data };
      if (Array.isArray(out.tags)) out.tags = (out.tags as any[]).filter(t => t.label).map(t => (t.accent ? { label: t.label, accent: true } : { label: t.label }));
      if (Array.isArray(out.stats)) out.stats = (out.stats as any[]).filter(s => s.value && s.label).map(s => ({ value: s.value, label: s.label }));
      return [lang, { data: clean(out), body }];
    }));
    try {
      await api('content', { action: 'save', collection, slug, isNew, langs: payload });
      dirty = false;
      status.classList.add('status--ok');
      status.textContent = isLocal ? 'Saved to your local files.' : 'Saved. The live site updates in about a minute.';
      if (isNew) {
        lastHash = `#/${path}/${slug}`;
        history.replaceState(null, '', lastHash);
        shell();
      }
    } catch (error) {
      status.textContent = describe(error);
    } finally {
      save.removeAttribute('disabled');
    }
  });

  const remove = !isNew && h('button', {
    class: 'a-btn a-btn--danger', type: 'button',
    onclick: async () => {
      if (!confirm(`Delete "${en.title}" in all languages? This can't be undone from here.`)) return;
      try {
        await api('content', { action: 'delete', collection, slug });
        dirty = false;
        location.hash = `#/${path}`;
      } catch (error) {
        status.textContent = describe(error);
      }
    },
  }, 'Delete');

  mount(main,
    h('div', { class: 'sticky-bar' }, h('div', { class: 'page-head', style: 'margin-bottom: 0' },
      h('div', {}, h('a', { href: `#/${path}`, class: 'muted' }, `← All ${path}`), h('h1', { style: 'margin-top: 6px' }, isNew ? `New ${singular}` : String(en.title || slug))),
      h('div', { class: 'actions' }, !isNew && !en.draft && h('a', { class: 'a-btn a-btn--ghost', href: `/${collection === 'blog' ? 'blog' : 'projects'}/${slug}`, target: '_blank', rel: 'noopener' }, 'View ↗'), remove, save),
    ), status),
    h('div', { class: 'editor' }, shared, h('div', {}, tabs, langArea)),
  );
  drawTabs();
  drawLang();
}

// ---------- security ----------
async function securityView(main: HTMLElement) {
  const { passkeys } = await api<{ passkeys: { id: string; name: string; createdAt: string }[] }>('passkey');
  const passkeyStatus = h('p', { class: 'status' });
  const passwordStatus = h('p', { class: 'status' });
  const supported = browserSupportsWebAuthn();

  const name = h('input', { placeholder: 'e.g. MacBook, iPhone', value: /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : 'Mac' }) as HTMLInputElement;
  const add = h('button', {
    class: 'a-btn', type: 'button', disabled: !supported,
    onclick: async () => {
      passkeyStatus.classList.remove('status--ok');
      passkeyStatus.textContent = '';
      try {
        const optionsJSON = await api('passkey', { action: 'register-options' });
        const response = await startRegistration({ optionsJSON });
        await api('passkey', { action: 'register-verify', response, name: name.value });
        await securityView(main);
      } catch (error) {
        passkeyStatus.textContent = describe(error);
      }
    },
  }, 'Add a passkey');

  const current = h('input', { type: 'password', autocomplete: 'current-password' }) as HTMLInputElement;
  const next = h('input', { type: 'password', autocomplete: 'new-password', minlength: 12 }) as HTMLInputElement;
  const changePassword = h('form', {
    class: 'panel',
    onsubmit: async (event: Event) => {
      event.preventDefault();
      passwordStatus.classList.remove('status--ok');
      try {
        await api('session', { action: 'password', current: current.value, next: next.value });
        passwordStatus.classList.add('status--ok');
        passwordStatus.textContent = 'Password changed.';
        current.value = next.value = '';
      } catch (error) {
        passwordStatus.textContent = describe(error);
      }
    },
  },
    h('h2', {}, 'Password'),
    h('div', { class: 'grid2' }, field('Current password', current), field('New password', next, 'At least 12 characters.')),
    h('div', {}, h('button', { class: 'a-btn a-btn--ghost', type: 'submit' }, 'Change password')),
    passwordStatus,
  );

  mount(main,
    pageHead(['Security ', h('em', {}, '& sign-in')], 'Passkeys let you sign in with Face ID or Touch ID instead of your password.'),
    h('section', { class: 'panel' },
      h('h2', {}, 'Passkeys'),
      passkeys.length ? h('div', { class: 'rows' }, passkeys.map(p => h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'row__title' }, p.name), h('div', { class: 'row__meta' }, `Added ${formatDate(p.createdAt)}`)),
        h('button', {
          class: 'a-btn a-btn--sm a-btn--danger',
          onclick: async () => {
            if (!confirm(`Remove the passkey "${p.name}"?`)) return;
            await api('passkey', { action: 'delete', id: p.id }).catch(error => alert(describe(error)));
            await securityView(main);
          },
        }, 'Remove'),
      ))) : h('p', { class: 'muted' }, 'No passkeys yet.'),
      supported ? h('div', { class: 'actions', style: 'align-items: flex-end' }, field('Name for this device', name), add)
        : h('p', { class: 'muted' }, "This browser doesn't support passkeys."),
      passkeyStatus,
    ),
    h('div', { style: 'height: 20px' }),
    changePassword,
  );
}

boot();
