import React from 'react';
import styled from 'styled-components';
import ClipLoader from 'react-spinners/ClipLoader';

const MessageContainer = styled.div`
  display: flex;
  justify-content: ${props => props.type === 'user' ? 'flex-end' : 'flex-start'};
  margin-bottom: 10px;
`;

const MessageBubble = styled.div`
  max-width: 70%;
  padding: 10px 15px;
  border-radius: 15px;
  background-color: ${props => props.type === 'user' ? '#007bff' : '#ffffff'};
  color: ${props => props.type === 'user' ? '#ffffff' : '#000000'};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
`;

const SpinnerContainer = styled.span`
  height: 45px;
  width: 45px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Message = ({ type, content, showSpinner }) => {
  return (
    <MessageContainer type={type}>
      <MessageBubble type={type}>
        {content}

      </MessageBubble>
      {showSpinner && (
          <SpinnerContainer>
            <ClipLoader color="#666" size={15} />
          </SpinnerContainer>
        )}
    </MessageContainer>
  );
};

export default Message;
