import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Send, Sparkles, TriangleAlert, CircleCheck, Lightbulb, MessageCircle, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { answerQuestion, getInsights, SUGGESTED_QUESTIONS } from '../utils/assistant'

const TONE_ICON = { warn: TriangleAlert, good: CircleCheck, info: Lightbulb }

export default function SpendingAssistant() {
  const { transactions, settings } = useApp()
  const insights = useMemo(() => getInsights(transactions, settings.currency).slice(0, 4), [transactions, settings.currency])
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])
  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  const ask = (question) => {
    const q = question.trim()
    if (!q || thinking) return
    setMessages((m) => [...m, { role: 'user', text: q }])
    setDraft('')
    setThinking(true)
    // A short pause so the answer doesn't appear before the question has registered.
    timer.current = setTimeout(() => {
      setMessages((m) => [...m, { role: 'assistant', ...answerQuestion(q, transactions, settings.currency) }])
      setThinking(false)
    }, 450)
  }

  const openChat = () => {
    setChatOpen(true)
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50)
  }

  return (
    <section className="card assistant fade-up" style={{ animationDelay: '200ms' }} aria-labelledby="assistant-title">
      <div className="card__head">
        <div className="assistant__heading">
          <span className="assistant__icon" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <div>
            <h3 id="assistant-title">
              AI Spending Assistant <span className="assistant__badge">Beta</span>
            </h3>
            <p className="muted">Personal insights from your transactions</p>
          </div>
        </div>
        {!chatOpen && (
          <button className="btn btn-primary btn-sm" onClick={openChat}>
            <MessageCircle size={15} /> Ask AI
          </button>
        )}
      </div>

      <ul className="assistant__insights">
        {insights.map((i) => {
          const Icon = TONE_ICON[i.tone] || Lightbulb
          return (
            <li key={i.id} className={`assistant-insight assistant-insight--${i.tone}`}>
              <span className="assistant-insight__icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <div>
                <div className="assistant-insight__title">{i.title}</div>
                <p className="assistant-insight__text">{i.text}</p>
              </div>
            </li>
          )
        })}
      </ul>

      {chatOpen && (
        <div className="assistant-chat">
          <div className="assistant-chat__head">
            <span>
              <Bot size={16} /> Ask about your spending
            </span>
            <button className="icon-btn icon-btn--sm" onClick={() => setChatOpen(false)} aria-label="Close chat">
              <X size={15} />
            </button>
          </div>

          <div className="assistant-chat__messages" ref={listRef} aria-live="polite">
            {!messages.length && <p className="assistant-chat__hint">Pick a question below or type your own.</p>}
            {messages.map((m, idx) => (
              <div key={idx} className={`chat-msg chat-msg--${m.role}`}>
                {m.role === 'assistant' && (
                  <span className="chat-msg__avatar" aria-hidden="true">
                    <Bot size={14} />
                  </span>
                )}
                <div className="chat-msg__bubble">
                  <p>{m.text}</p>
                  {m.bullets?.length > 0 && (
                    <ul>
                      {m.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="chat-msg chat-msg--assistant">
                <span className="chat-msg__avatar" aria-hidden="true">
                  <Bot size={14} />
                </span>
                <div className="chat-msg__bubble chat-msg__typing" aria-label="Assistant is thinking">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          <div className="assistant-chat__chips">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button key={q} className="chat-chip" onClick={() => ask(q)} disabled={thinking}>
                {q}
              </button>
            ))}
          </div>

          <form
            className="assistant-chat__form"
            onSubmit={(e) => {
              e.preventDefault()
              ask(draft)
            }}
          >
            <input
              ref={inputRef}
              className="input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. How much did I spend on food?"
              aria-label="Ask a question about your spending"
              maxLength={200}
              enterKeyHint="send"
            />
            <button type="submit" className="btn btn-primary assistant-chat__send" disabled={!draft.trim() || thinking} aria-label="Send">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
