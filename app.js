const chat = document.getElementById('chat')
const form = document.getElementById('form')
const input = document.getElementById('q')
const btn = document.getElementById('btn')
const byteCounter = document.getElementById('byteCounter')
const dateLabel = document.getElementById('dateLabel')
const scrollUpBtn = document.getElementById('scrollUpBtn')
const clearBtn = document.getElementById('clearBtn')
const backBtn = document.getElementById('backBtn')
const fwdBtn = document.getElementById('fwdBtn')
const homeBtn = document.getElementById('homeBtn')

/* ---------- 마크다운 → HTML 변환 (가벼운 자체 구현) ---------- */

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function mdInline(str) {
  // 이미 escapeHtml을 거친 문자열을 받는다고 가정
  str = str.replace(/`([^`]+)`/g, '<code>$1</code>')
  str = str.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  str = str.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  str = str.replace(/(^|[^_])_([^_]+)_(?!_)/g, '$1<em>$2</em>')
  str = str.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  return str
}

function mdToHtml(raw) {
  const lines = escapeHtml(raw).split('\n')
  let html = ''
  let i = 0
  let inCode = false
  let codeBuf = []
  let listType = null
  let listBuf = []

  function flushList() {
    if (listType) {
      html += `<${listType}>` +
        listBuf.map(li => `<li>${mdInline(li)}</li>`).join('') +
        `</${listType}>`
      listType = null
      listBuf = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    if (/^```/.test(line)) {
      flushList()
      if (!inCode) { inCode = true; codeBuf = []; i++; continue }
      inCode = false
      html += `<pre><code>${codeBuf.join('\n')}</code></pre>`
      i++
      continue
    }
    if (inCode) { codeBuf.push(line); i++; continue }

    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      flushList()
      const lvl = h[1].length
      html += `<h${lvl} class="md-h">${mdInline(h[2])}</h${lvl}>`
      i++
      continue
    }

    const bq = line.match(/^&gt;\s?(.*)$/)
    if (bq) {
      flushList()
      html += `<blockquote>${mdInline(bq[1])}</blockquote>`
      i++
      continue
    }

    const ul = line.match(/^[-*]\s+(.*)$/)
    if (ul) {
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listBuf.push(ul[1])
      i++
      continue
    }

    const ol = line.match(/^\d+\.\s+(.*)$/)
    if (ol) {
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listBuf.push(ol[1])
      i++
      continue
    }

    if (line.trim() === '') {
      // 빈 줄 다음에도 같은 종류의 리스트 항목이 이어지면
      // (예: "1. ...\n\n2. ...") 리스트를 끊지 않고 계속 이어간다.
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++
      const nextLine = lines[j]
      const nextIsUl = nextLine !== undefined && /^[-*]\s+/.test(nextLine)
      const nextIsOl = nextLine !== undefined && /^\d+\.\s+/.test(nextLine)

      if (listType === 'ul' && nextIsUl) { i++; continue }
      if (listType === 'ol' && nextIsOl) { i++; continue }

      flushList()
      i++
      continue
    }

    flushList()
    const paraLines = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^```/.test(lines[i]) &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^&gt;\s?/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    html += `<p>${paraLines.map(mdInline).join('<br>')}</p>`
  }

  flushList()
  if (inCode) html += `<pre><code>${codeBuf.join('\n')}</code></pre>`
  return html
}

function formatTime(d) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function updateDateLabel() {
  const d = new Date()
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  dateLabel.textContent = `${y}.${mo}.${da} ${days[d.getDay()]}`
}

function updateByteCounter() {
  // Korean/complete chars roughly count as 2 bytes on old feature phones
  let bytes = 0
  for (const ch of input.value) {
    bytes += ch.charCodeAt(0) > 127 ? 2 : 1
  }
  byteCounter.textContent = `(${bytes} / 400)`
}

function addMessage(text, role) {
  const currentEmptyState = document.getElementById('emptyState')
  if (currentEmptyState) currentEmptyState.remove()

  const el = document.createElement('div')
  el.className = 'msg ' + role

  const head = document.createElement('div')
  head.className = 'msg-head'

  const name = document.createElement('span')
  name.className = 'msg-name'
  name.textContent = role.includes('user') ? 'ME' : 'AI'

  const time = document.createElement('span')
  time.className = 'msg-time'
  time.textContent = formatTime(new Date())

  head.appendChild(name)
  head.appendChild(time)

  const textEl = document.createElement('div')
  textEl.className = 'msg-text'
  if (role.includes('user')) {
    textEl.textContent = text
  } else {
    textEl.innerHTML = mdToHtml(text)
  }

  el.appendChild(head)
  el.appendChild(textEl)
  chat.appendChild(el)
  chat.scrollTop = chat.scrollHeight
  return el
}

function setMessageText(el, text) {
  const t = el.querySelector('.msg-text')
  if (!t) return
  if (el.classList.contains('user')) {
    t.textContent = text
  } else {
    t.innerHTML = mdToHtml(text)
  }
}

updateDateLabel()
updateByteCounter()

input.addEventListener('input', updateByteCounter)

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const prompt = input.value.trim()
  if (!prompt) return

  addMessage(prompt, 'user')
  input.value = ''
  updateByteCounter()
  input.focus()
  btn.disabled = true

  const loadingEl = addMessage('생각 중...', 'ai loading')

  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })
    .then(res => res.json())
    .then(data => {
      setMessageText(loadingEl, data.reply || data.error || '(응답없음)')
      loadingEl.classList.remove('loading')
    })
    .catch(() => {
      setMessageText(loadingEl, '❌ 서버 안 켜짐? (server서 node index.js 먼저)')
      loadingEl.classList.remove('loading')
    })
    .finally(() => {
      btn.disabled = false
    })
})

scrollUpBtn.addEventListener('click', () => {
  chat.scrollBy({ top: -120, behavior: 'smooth' })
})

clearBtn.addEventListener('click', () => {
  chat.scrollBy({ top: 120, behavior: 'smooth' })
})

backBtn.addEventListener('click', () => {
  chat.scrollTo({ top: 0, behavior: 'smooth' })
})

fwdBtn.addEventListener('click', () => {
  chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' })
})

homeBtn.addEventListener('click', () => {
  chat.innerHTML = ''
  const div = document.createElement('div')
  div.className = 'empty-state'
  div.id = 'emptyState'
  div.innerHTML = '<p>무엇을 도와드릴까요?</p>'
  chat.appendChild(div)
})