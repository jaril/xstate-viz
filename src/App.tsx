import { ExternalLinkIcon } from '@chakra-ui/icons';
import { Button } from '@chakra-ui/react';
import { useActor, useInterpret, useSelector } from '@xstate/react';
import router, { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';
import { AppHead } from './AppHead';
import { useAuth } from './authContext';
import { CanvasProvider } from './CanvasContext';
import { canvasMachine, canvasModel } from './canvasMachine';
import { CanvasView } from './CanvasView';
import { CommonAppProviders } from './CommonAppProviders';
import { EmbedProvider, useEmbed } from './embedContext';
import { isOnClientSide } from './isOnClientSide';
import { Login } from './Login';
import { MachineNameChooserModal } from './MachineNameChooserModal';
import { PaletteProvider } from './PaletteContext';
import { paletteMachine } from './paletteMachine';
import { PanelsView } from './PanelsView';
import { registryLinks } from './registryLinks';
import { RootContainer } from './RootContainer';
import { useSimulation } from './SimulationContext';
import { getSourceActor, useSourceRegistryData } from './sourceMachine';
import { ActorsTab } from './tabs/ActorsTab';
import { CodeTab } from './tabs/CodeTab';
import { EventsTab } from './tabs/EventsTab';
import { SettingsTab } from './tabs/SettingsTab';
import { StateTab } from './tabs/StateTab';
import { EmbedMode } from './types';
import {
  calculatePanelIndexByPanelName,
  parseEmbedQuery,
  withoutEmbedQueryParams,
} from './utils';

const defaultHeadProps = {
  title: 'XState Visualizer',
  ogTitle: 'XState Visualizer',
  description: 'Visualizer for XState state machines and statecharts',
  // TODO - get an OG image for the home page
  ogImageUrl: null,
};

const VizHead = () => {
  const sourceRegistryData = useSourceRegistryData();

  if (!sourceRegistryData) {
    return <AppHead {...defaultHeadProps} />;
  }

  return (
    <AppHead
      title={[sourceRegistryData.system?.name, defaultHeadProps.title]
        .filter(Boolean)
        .join(' | ')}
      ogTitle={sourceRegistryData.system?.name || defaultHeadProps.ogTitle}
      description={
        sourceRegistryData.system?.name || defaultHeadProps.description
      }
      ogImageUrl={registryLinks.sourceFileOgImage(sourceRegistryData.id)}
    />
  );
};

const useReceiveMessage = (
  eventHandlers?: Record<string, (data: any) => void>,
) => {
  useEffect(() => {
    window.onmessage = async (message) => {
      const { data } = message;
      eventHandlers && eventHandlers[data.type]?.(data);
    };
  }, []);
};

function WebApp() {
  const embed = useEmbed();
  const simService = useSimulation();
  const machine = useSelector(simService, (state) => {
    return state.context.currentSessionId
      ? state.context.serviceDataMap[state.context.currentSessionId!]?.machine
      : undefined;
  });

  const sourceService = useSelector(useAuth(), getSourceActor);
  const [sourceState, sendToSourceService] = useActor(sourceService!);
  const sourceID = sourceState!.context.sourceID;

  const canvasService = useInterpret(canvasMachine, {
    context: {
      ...canvasModel.initialContext,
      sourceID,
      zoomable: !embed?.isEmbedded || embed.zoom,
      pannable: !embed?.isEmbedded || embed.pan,
    },
  });

  useReceiveMessage({
    // used to receive messages from the iframe in embed preview
    EMBED_PARAMS_CHANGED: (data) => {
      router.replace(data.url, data.url);
    },
  });

  useEffect(() => {
    sendToSourceService({
      type: 'MACHINE_ID_CHANGED',
      id: machine?.id || '',
    });
  }, [machine?.id, sendToSourceService]);

  useEffect(() => {
    canvasService.send({
      type: 'SOURCE_CHANGED',
      id: sourceID,
    });
  }, [sourceID, canvasService]);

  const shouldRenderCanvas =
    !embed?.isEmbedded || embed.mode !== EmbedMode.Panels;
  const shouldRenderPanels = !embed?.isEmbedded || embed.mode !== EmbedMode.Viz;

  return (
    <>
      <RootContainer
        canvas={
          shouldRenderCanvas && (
            <CanvasProvider value={canvasService}>
              <CanvasView />
            </CanvasProvider>
          )
        }
        panels={
          shouldRenderPanels && (
            <PanelsView
              defaultIndex={
                embed?.isEmbedded
                  ? calculatePanelIndexByPanelName(embed.panel)
                  : 0
              }
              tabs={(() => {
                const tabs = [CodeTab, StateTab, EventsTab, ActorsTab];
                if (!embed?.isEmbedded) {
                  tabs.push(SettingsTab);
                }
                return tabs;
              })()}
              tabListRightButtons={
                !embed?.isEmbedded ? (
                  <Login />
                ) : embed.showOriginalLink && embed.originalUrl ? (
                  <Button
                    height="100%"
                    rounded="none"
                    marginLeft="auto"
                    colorScheme="blue"
                    as="a"
                    target="_blank"
                    rel="noopener noreferer nofollow"
                    href={embed?.originalUrl}
                    leftIcon={<ExternalLinkIcon />}
                  >
                    Open in Stately.ai/viz
                  </Button>
                ) : null
              }
              resizable={!embed?.isEmbedded || embed.mode === EmbedMode.Full}
            />
          )
        }
      />
      <MachineNameChooserModal />
    </>
  );
}

function App({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { query, asPath } = useRouter();
  const embed = useMemo(
    () => ({
      ...parseEmbedQuery(query),
      isEmbedded,
      originalUrl: withoutEmbedQueryParams(query),
    }),
    [query, asPath],
  );

  const paletteService = useInterpret(paletteMachine);

  return (
    <>
      <VizHead />
      {/* This is because we're doing loads of things on client side anyway */}
      {isOnClientSide() && (
        <CommonAppProviders>
          <EmbedProvider value={embed}>
            <PaletteProvider value={paletteService}>
              <WebApp />
            </PaletteProvider>
          </EmbedProvider>
        </CommonAppProviders>
      )}
    </>
  );
}

export default App;
