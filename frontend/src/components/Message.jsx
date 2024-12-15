import React from 'react';
import styled from 'styled-components';
import ClipLoader from 'react-spinners/ClipLoader';

const MessageContainer = styled.div`
  display: flex;
  justify-content: ${props => props.type === 'user' ? 'flex-end' : 'flex-start'};
  margin-bottom: 10px;
`;

const MessageContent = styled.div`
  display: flex;
  flex-direction: column;
`;

const MessageBubble = styled.div`
  max-width: 100%;
  padding: 10px 15px;
  border-radius: 15px;
  background-color: ${props => props.type === 'user' ? '#007bff' : '#ffffff'};
  color: ${props => props.type === 'user' ? '#ffffff' : '#000000'};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
`;

const ResponseTime = styled.span`
  font-size: 12px;
  color: #666;
  margin-top: 4px;
  margin-left: 5px;
`;

const SpinnerContainer = styled.span`
  height: 45px;
  width: 45px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Message = ({ type, content, showSpinner, responseTime }) => {
  return (
    <MessageContainer type={type}>
      <MessageContent>
        <MessageBubble type={type}>
          {content}
        </MessageBubble>
        {type === 'assistant' && responseTime && (
          <ResponseTime>
            Temps de réponse : {responseTime}s
          </ResponseTime>
        )}
      </MessageContent>
      {showSpinner && (
        <SpinnerContainer>
          <ClipLoader color="#666" size={15} />
        </SpinnerContainer>
      )}
    </MessageContainer>
  );
};

export default Message;
