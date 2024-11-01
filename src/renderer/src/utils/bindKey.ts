type KeyHandler = (key: string) => void

export const bindKey = (handler: KeyHandler): (() => void) => {
  const handleKeyPress = (event: KeyboardEvent) => {
    handler(event.key)
  }

  window.addEventListener('keydown', handleKeyPress)

  return () => {
    window.removeEventListener('keydown', handleKeyPress)
  }
}
