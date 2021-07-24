import { useMemo } from 'react';
import { useInterpret, useMachine, useSelector } from '@xstate/react';
import './Graph';
import { toDirectedGraph } from './directedGraph';
import { CanvasPanel } from './CanvasPanel';
import { SimulationProvider } from './SimulationContext';
import './base.scss';
import { EditorPanel } from './EditorPanel';
import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Box,
  Text,
} from '@chakra-ui/react';
import { ChakraProvider } from '@chakra-ui/react';
import { theme } from './theme';
import { StatePanel } from './StatePanel';
import { EventsPanel } from './EventsPanel';
import { ActorsPanel } from './ActorsPanel';
import { Login } from './Login';

import { clientMachine } from './clientMachine';
import { ClientProvider } from './clientContext';
import { sourceMachine } from './sourceMachine';
import { SpinnerWithText } from './SpinnerWithText';
import { ResizableBox } from './ResizableBox';
import { simulationMachine } from './simulationMachine';
import { useInterpretCanvas } from './useInterpretCanvas';
import { CanvasProvider } from './CanvasContext';
import { SimMode } from './types';

const initialMachineCode = `
import { createMachine } from 'xstate';
`.trim();

function App() {
  const simService = useInterpret(simulationMachine);
  const machine = useSelector(simService, (state) => {
    return state.context.currentSessionId
      ? state.context.serviceDataMap[state.context.currentSessionId!]?.machine
      : undefined;
  });
  const digraph = useMemo(
    () => (machine ? toDirectedGraph(machine) : undefined),
    [machine],
  );
  const clientService = useInterpret(clientMachine);
  const createdMachine = useSelector(
    clientService,
    (state) => state.context.createdMachine,
  );
  const [sourceState] = useMachine(sourceMachine);

  const mode: SimMode = useSelector(simService, (state) =>
    state.hasTag('inspecting') ? 'inspecting' : 'visualizing',
  );

  const isUpdateMode =
    sourceState.context.sourceProvider === 'registry' || !!createdMachine;
  const sourceID =
    sourceState.context.sourceProvider === 'registry'
      ? sourceState.context.sourceID
      : createdMachine?.id;

  const canvasService = useInterpretCanvas({
    sourceID,
  });

  return (
    <SimulationProvider value={simService}>
      <Box
        data-testid="app"
        data-viz-theme="dark"
        as="main"
        display="grid"
        gridTemplateColumns="1fr auto"
        gridTemplateRows="1fr auto"
        gridTemplateAreas="'canvas panels' 'footer footer'"
        height="100vh"
      >
        {digraph ? (
          <CanvasProvider value={canvasService}>
            <CanvasPanel digraph={digraph} />
          </CanvasProvider>
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center">
            <Text textAlign="center">
              No machines to display yet...
              <br />
              Create one!
            </Text>
          </Box>
        )}
        <ClientProvider value={clientService}>
          <ChakraProvider theme={theme}>
            <ResizableBox gridArea="panels">
              <Login />
              <Tabs
                bg="gray.800"
                display="grid"
                gridTemplateRows="auto 1fr"
                height="100%"
              >
                <TabList>
                  <Tab>Code</Tab>
                  <Tab>State</Tab>
                  <Tab>Events</Tab>
                  <Tab>Actors</Tab>
                </TabList>

                <TabPanels minHeight={0}>
                  <TabPanel padding={0} height="100%">
                    {sourceState.matches({
                      with_source: 'loading_content',
                    }) && (
                      <SpinnerWithText
                        text={`Loading source from ${sourceState.context.sourceProvider}`}
                      />
                    )}
                    {!sourceState.matches({
                      with_source: 'loading_content',
                    }) && (
                      <EditorPanel
                        immediateUpdate={Boolean(
                          sourceState.context.sourceRawContent,
                        )}
                        defaultValue={
                          sourceState.context.sourceRawContent ||
                          initialMachineCode
                        }
                        onChangedCodeValue={(code) => {
                          clientService.send({
                            type: 'CODE_UPDATED',
                            code,
                            sourceID: sourceState.context.sourceID,
                          });
                        }}
                        isUpdateMode={isUpdateMode}
                        onSave={(code: string) => {
                          if (isUpdateMode) {
                            clientService.send({
                              type: 'UPDATE',
                              id: sourceID,
                              rawSource: code,
                            });
                          } else {
                            clientService.send({
                              type: 'SAVE',
                              rawSource: code,
                            });
                          }
                        }}
                        onChange={(machines) => {
                          simService.send({
                            type: 'MACHINES.REGISTER',
                            machines,
                          });
                        }}
                      />
                    )}
                  </TabPanel>
                  <TabPanel>
                    <StatePanel />
                  </TabPanel>
                  <TabPanel overflow="hidden" height="100%">
                    <EventsPanel />
                  </TabPanel>
                  <TabPanel>
                    <ActorsPanel />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </ResizableBox>
            <Box
              gridArea="footer"
              background={mode === 'inspecting' ? 'orange.500' : 'black'}
              padding="2"
            >
              <Text fontWeight="bold">
                {mode === 'inspecting' ? 'Inspecting' : 'Viz'}
              </Text>
            </Box>
          </ChakraProvider>
        </ClientProvider>
      </Box>
    </SimulationProvider>
  );
}

export default App;
