import React from 'react'
import LogoRotator from './logobanner'
import InfoText from './infoText'
import DateTimeDisplay from './dateTimeDisplay'

const TopBanner: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: '#444444',
        zIndex: 10,
        display: 'flex',
        width: '100%',
        height: '7%',
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        alignItems: 'center'
      }}
    >
      <div
        style={{
          flex: '1',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          margin: '0 5px'
        }}
      >
        <LogoRotator maxHeight={72} maxWidth="100%" />
      </div>
      <div
        style={{ flex: '0 0 2px', height: '60%', backgroundColor: '#888888', margin: '0 5px' }}
      ></div>
      <div
        style={{
          flex: '8',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          margin: '0 5px'
        }}
      >
        <InfoText className="w-full" />
      </div>
      <div
        style={{ flex: '0 0 2px', height: '60%', backgroundColor: '#888888', margin: '0 5px' }}
      ></div>
      <div
        style={{
          flex: '1',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 5px'
        }}
      >
        <DateTimeDisplay />
      </div>
    </div>
  )
}

export default TopBanner
