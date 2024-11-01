import { speakCharacter } from './speakCharacter'
import { Screenplay } from './messages'

const fillers = [
  'えーと',
  'うーん',
  'そうですね',
  'ちょっと考えさせてください',
  'はい、わかりました'
]

export const speakFiller = (callback: () => void) => {
  const filler = fillers[Math.floor(Math.random() * fillers.length)]
  const screenplay: Screenplay = {
    expression: 'neutral',
    talk: {
      style: 'talk',
      message: filler
    }
  }
  speakCharacter(screenplay, callback, () => {})
}
