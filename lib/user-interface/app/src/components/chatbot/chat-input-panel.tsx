import {
  Button,
  Container,
  Icon,
  Select,
  SelectProps,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Checkbox
} from "@cloudscape-design/components";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { Auth } from "aws-amplify";
import TextareaAutosize from "react-textarea-autosize";
import { ReadyState } from "react-use-websocket";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import styles from "../../styles/chat.module.scss";
import {  
  ChatBotHistoryItem,  
  ChatBotMessageType,
  ChatInputState,  
} from "./types";
import {  
  assembleHistory
} from "./utils";
import { Utils } from "../../common/utils";
import {SessionRefreshContext} from "../../common/session-refresh-context"
import { useNotifications } from "../notif-manager";
//import AWS from '../../../../public/aws-exports.json'; - SARAH testing

export interface ChatInputPanelProps {
  running: boolean;
  setRunning: Dispatch<SetStateAction<boolean>>;
  session: { id: string; loading: boolean };
  messageHistory: ChatBotHistoryItem[];
  setMessageHistory: (history: ChatBotHistoryItem[]) => void;  
}

export abstract class ChatScrollState {
  static userHasScrolled = false;
  static skipNextScrollEvent = false;
  static skipNextHistoryUpdate = false;
}

//Make an enumerator class that helps track our stage in the application (1st: None, 2nd: Decision Tree made, 3rd: Eligbibilty Screener made)
const Stages = Object.freeze({
  START: Symbol("start"),
  TREE: Symbol("tree"),
  HTML_SCREENER: Symbol("HTML screener"),
  CSS_SCREENER: Symbol("CSS screener"),
  JS_SCREENER: Symbol("JS screener"),
});

export default function ChatInputPanel(props: ChatInputPanelProps) {
  const appContext = useContext(AppContext);
  const {needsRefresh, setNeedsRefresh} = useContext(SessionRefreshContext);
  //the stage of the chatbot that we are in (1st: Start, 2nd: Decision Tree made, 3rd: Eligbibilty Screener made)
  const [stageChatbot, setStageChatbot] = useState(Stages.START);
  const { transcript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const [state, setState] = useState<ChatInputState>({
    value: "",
  });
  const { notifications, addNotification } = useNotifications();
  const [readyState, setReadyState] = useState<ReadyState>(
    ReadyState.OPEN
  );  
  const messageHistoryRef = useRef<ChatBotHistoryItem[]>([]);
  const [
    selectedDataSource,
    setSelectedDataSource
  ] = useState({ label: "Bedrock Knowledge Base", value: "kb" } as SelectProps.ChangeDetail["selectedOption"]);
  const [interactionCount, setInteractionCount] = useState(0); // Track the number of interactions
  const [previousDecisionTree, setPreviousDecisionTree] = useState<string | null>(null); // Track the previous decision tree
  const [generatedHTMLCode, setgeneratedHTMLCode] = useState<string | null>(null); // Track the previous html code

  useEffect(() => {
    messageHistoryRef.current = props.messageHistory;    
  }, [props.messageHistory]);
  
  /** checkboxes */
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  /** Speech recognition */
  useEffect(() => {
    if (transcript) {
      setState((state) => ({ ...state, value: transcript }));
    }
  }, [transcript]);

  /**Some amount of auto-scrolling for convenience */
  useEffect(() => {
    const onWindowScroll = () => {
      if (ChatScrollState.skipNextScrollEvent) {
        ChatScrollState.skipNextScrollEvent = false;
        return;
      }
      const isScrollToTheEnd =
        Math.abs(
          window.innerHeight +
          window.scrollY -
          document.documentElement.scrollHeight
        ) <= 10;
      if (!isScrollToTheEnd) {
        ChatScrollState.userHasScrolled = true;
      } else {
        ChatScrollState.userHasScrolled = false;
      }
    };
    window.addEventListener("scroll", onWindowScroll);
    return () => {
      window.removeEventListener("scroll", onWindowScroll);
    };
  }, []);
  useLayoutEffect(() => {
    if (ChatScrollState.skipNextHistoryUpdate) {
      ChatScrollState.skipNextHistoryUpdate = false;
      return;
    }
    if (!ChatScrollState.userHasScrolled && props.messageHistory.length > 0) {
      ChatScrollState.skipNextScrollEvent = true;
      window.scrollTo({
        top: document.documentElement.scrollHeight + 1000,
        behavior: "instant",
      });
    }
  }, [props.messageHistory]);

  /** Sends a message to the chat API */
  const handleSendMessage = async () => {
    if (props.running) return;
    if (readyState !== ReadyState.OPEN) return;
    ChatScrollState.userHasScrolled = false;
    let username;
    await Auth.currentAuthenticatedUser().then((value) => username = value.username);
    if (!username) return;    

    let messageTemporary = "";
    let userMessage = "";

    const hardcodedQuestions = [
      "Do you have MassHealth?",
      "Do you have a SSN?",
      "What is your household size?",
      "Do you have children under 19?",
      "Do you have children under 5?"
    ];

    if (stageChatbot === Stages.START) {
      if (state.value.trim() === "") {
        messageTemporary = "Create a comprehensive and dynamic question flow designed for screening eligibility for only the federal benefit programs: " + selectedOptions.join(", ") +
        ". The questionnaire should be adaptable, with questions changing based on previous answers to maintain relevance and streamline the user experience. Ensure the questions address" +
        "key eligibility criteria such as income, family size, and having a social security number. For each program, design it to ask general questions first, followed by more specific ones only if needed." +
        "Include logic that avoids redundant questions and guides users through clear pathways depending on their responses.";
      } else {
        messageTemporary = "Generate a decision tree for an eligibility screener for the following programs: " + selectedOptions.join(", ") + ". Include these notes: " + state.value + ". Ensure to include questions from the document in my Bedrock S3 bucket and also consider other related documents for eligibility. Additionally, include the following questions: " + hardcodedQuestions.join(", ") + ". Then ask me for notes";
      } 
      userMessage = "Creating a comprehensive question flow for " + selectedOptions.join(", ") + ". Please wait...";
      setStageChatbot(Stages.TREE);
    } else if (stageChatbot === Stages.TREE) {
        messageTemporary =  "Using the existing decision tree for " + selectedOptions.join(", ") + ", generate a single, combined decision tree that evaluates eligibility for both programs together." + 
        "Ensure that the tree is optimized to avoid redundant questions. Incorporate all questions from both trees, to ensure compressive accurate screening, and design the flow so" + 
        "that common questions are asked only once, with unique questions asked only as necessary. Include specifics of each question. For income level clairfy the dollar amount. For household size, clarify the exact sizes. The output should clarify all questions using specifics related to the question, detailing the logic at each decision point to allow verification of accuracy by a human reviewer." + state.value.trim();
        userMessage = "Generating a combined decision tree. Please wait...";
        setStageChatbot(Stages.HTML_SCREENER)
    } else if (stageChatbot === Stages.HTML_SCREENER) {
        messageTemporary = "Generate the HTML code for a responsive web application that presents eligibility questions for federal benefit programs: " + selectedOptions.join(", ") +
        ". Follow this decision tree structure: " + previousDecisionTree + ". Display each question based on prior responses and include a 'Check Eligibility' button to initiate the eligibility check." +
        "Use HTML structure that will be easy to style and add JavaScript interactions in later steps.";
        userMessage = "Generating HTML code for the eligibility screener. Please wait...";
        setStageChatbot(Stages.CSS_SCREENER)
    } else if (stageChatbot === Stages.CSS_SCREENER) {
        messageTemporary = "Generate the CSS for the following HTML code to create a responsive and user-friendly interface: " + generatedHTMLCode +
        ". Style the form, input fields, and results area for a clean look. Ensure responsive design for compatibility with different screen sizes (mobile, tablet, desktop)." +
        "Use class selectors from the HTML to apply styling rules that enhance visual appeal and user experience.";
        userMessage = "Generating CSS for the eligibility screener. Please wait...";
        setStageChatbot(Stages.JS_SCREENER)
    } else if (stageChatbot === Stages.JS_SCREENER) {
        messageTemporary = "Generate JavaScript code (app.js) for the following HTML structure to implement dynamic eligibility logic: " + generatedHTMLCode +
        ". Capture form inputs, use decision tree logic to determine program eligibility, and display the results on the same page." +
        "Include logic for the 'Check Eligibility' button and provide inline comments to clarify the code structure. Add setup instructions for running locally.";
        userMessage = "Generating JavaScript for the eligibility screener. Please wait...";
    }
  

    setState({ value: "" });    
    const messageToSend = messageTemporary;

    try {
      props.setRunning(true);
      let receivedData = '';    
    

      /** Add the user's query to the message history and a blank dummy message for the chatbot as the response loads */
      messageHistoryRef.current = [
        ...messageHistoryRef.current,
        {
          type: ChatBotMessageType.Human,
          content: userMessage, // displaying hard coded message
          metadata: {},
        },
        {
          type: ChatBotMessageType.AI,          
          content: receivedData,
          metadata: {},
        },
      ];
      
      props.setMessageHistory(messageHistoryRef.current);
      let firstTime = false;
      if (messageHistoryRef.current.length < 3) {
        firstTime = true;
      }

      const TEST_URL = appContext.wsEndpoint + "/";
      const TOKEN = await Utils.authenticate();
      const wsUrl = TEST_URL + '?Authorization=' + TOKEN;
      const ws = new WebSocket(wsUrl);
      let incomingMetadata = false;
      let sources = {};

      /** If there is no response after a minute, time out the response to try again. */
      setTimeout(() => {
        if (receivedData == '') {
          ws.close();
          messageHistoryRef.current.pop();
          messageHistoryRef.current.push({
            type: ChatBotMessageType.AI,          
            content: 'Response timed out!',
            metadata: {},
          });
        }
      }, 120000);

      // Event listener for when the connection is open
      ws.addEventListener('open', function open() {
        console.log('Connected to the WebSocket server');        
        const message = JSON.stringify({
          "action": "getChatbotResponse",
          "data": {
            userMessage: messageToSend,
            chatHistory: assembleHistory(messageHistoryRef.current.slice(0, -2)),
            systemPrompt: `You are an AI chatbot for Link Health, a non-profit organization to help connect patients to federal benefit programs. 
            Create a decision tree that screens eligibility for the following programs: ${selectedOptions.join(", ")} with the following criteria:
            - Start with initial screening questions about residency and key eligibility factors.
            - Only ask specific questions about the selected programs eligibility after confirming key criteria.
            - Ensure that only relevant questions are asked based on prior responses.
            - Format the output to include user paths, clearly showing the flow based on responses, and the final eligibility determination.
            
            Example:
            1. Do you have MassHealth (Medicaid)?
              - If yes → Next question
              - If no → Check if you meet income requirements
            2. Do you have children under 5 or under 18 in your household?
              - If yes → Next question
              - If no → Check if you meet other eligibility criteria
            3. Do you have a Social Security Number (SSN)?
              - If yes → Proceed to screening questions
              - If no → You may still be eligible if you are an eligible immigrant
            4. [Continue this pattern for specific eligibility questions for the selected programs]`,
            projectId: 'rsrs111111',
            user_id: username,
            session_id: props.session.id,
            retrievalSource: selectedDataSource.value
          }
        });
        
        ws.send(message);
      });

      // Event listener for incoming messages
      ws.addEventListener('message', async function incoming(data) {
        if (data.data.includes("<!ERROR!>:")) {
          addNotification("error", data.data);          
          ws.close();
          return;
        }

        if (data.data == '!<|EOF_STREAM|>!') {          
          incomingMetadata = true;
          return;          
        }

        if (!incomingMetadata) {
          receivedData += data.data;
        } else {
          let sourceData = JSON.parse(data.data);
          sourceData = sourceData.map((item) => {
            if (item.title == "") {
              return { title: item.uri.slice((item.uri as string).lastIndexOf("/") + 1), uri: item.uri };
            } else {
              return item;
            }
          });
          sources = { "Sources": sourceData };
          console.log(sources);
        }

        // Update the chat history state with the new message        
        messageHistoryRef.current = [
          ...messageHistoryRef.current.slice(0, -2),
          {
            type: ChatBotMessageType.Human,
            content: userMessage,
            metadata: {},
          },
          {
            type: ChatBotMessageType.AI,            
            content: receivedData,
            metadata: sources,
          },
        ];        
        props.setMessageHistory(messageHistoryRef.current);

        // Store the decision tree from the model's response
        if (stageChatbot === Stages.TREE) {
          setPreviousDecisionTree(receivedData);
        }

        // Store the html code from the model's response
        if (stageChatbot === Stages.HTML_SCREENER) {
          setgeneratedHTMLCode(receivedData);
        }
      });

      // Handle possible errors
      ws.addEventListener('error', function error(err) {
        console.error('WebSocket error:', err);
      });

      // Handle WebSocket closure
      ws.addEventListener('close', async function close() {
        if (firstTime) {             
          Utils.delay(1500).then(() => setNeedsRefresh(true));
        }
        props.setRunning(false);        
        console.log('Disconnected from the WebSocket server');
      });
    } catch (error) {      
      console.error('Error sending message:', error);
      alert('Sorry, something has gone horribly wrong! Please try again or refresh the page.');
      props.setRunning(false);
    }     

    // Increment the interaction count
    setInteractionCount(interactionCount + 1);
  };

  const handleCheckboxChange = (option: string) => {
    setSelectedOptions((prevSelectedOptions) =>
      prevSelectedOptions.includes(option)
        ? prevSelectedOptions.filter((o) => o !== option)
        : [...prevSelectedOptions, option]
    );
  };

  const options = ["SNAP", "Lifeline", "WIC"]; // Define your eligibility options

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  return (
    <SpaceBetween direction="vertical" size="l">
      <Container>
        {interactionCount === 0 && (
          <div className="checkbox-container">
            {options.map((option) => (
              <Checkbox
                key={option}
                checked={selectedOptions.includes(option)}
                onChange={() => handleCheckboxChange(option)}
              >
                {option}
              </Checkbox>
            ))}
          </div>
        )}
        <div className={styles.input_textarea_container}>
          <SpaceBetween size="xxs" direction="horizontal" alignItems="center">
          </SpaceBetween>
          <TextareaAutosize
            className={styles.input_textarea}
            maxRows={6}
            minRows={1}
            spellCheck={true}
            autoFocus
            onChange={(e) =>
              setState((state) => ({ ...state, value: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key == "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            value={state.value}
          />
          <Button onClick={handleSendMessage}>Send</Button>
        </div>
      </Container>
    </SpaceBetween>
  );
};