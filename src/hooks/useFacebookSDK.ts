import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

interface FacebookSDKState {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  appId: string | null;
  configId: string | null;
}

interface EmbeddedSignupResult {
  code: string;
  waba_id?: string;
  phone_number_id?: string;
}

export function useFacebookSDK() {
  const [state, setState] = useState<FacebookSDKState>({
    isLoaded: false,
    isLoading: false,
    error: null,
    appId: null,
    configId: null,
  });

  // Fetch app config from backend
  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-embedded-signup', {
        body: { action: 'get_config' },
      });

      if (error) throw error;

      return {
        appId: data.app_id,
        configId: data.config_id,
      };
    } catch (err) {
      console.error('Error fetching FB config:', err);
      return null;
    }
  }, []);

  // Load Facebook SDK
  const loadSDK = useCallback(async () => {
    if (state.isLoaded || state.isLoading) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const config = await fetchConfig();
    if (!config?.appId) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Configuração do Meta App não encontrada. Contate o suporte.',
      }));
      return;
    }

    // Check if already loaded
    if (window.FB) {
      setState({
        isLoaded: true,
        isLoading: false,
        error: null,
        appId: config.appId,
        configId: config.configId,
      });
      return;
    }

    // Set up FB init callback
    window.fbAsyncInit = () => {
      window.FB.init({
        appId: config.appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v22.0',
      });

      setState({
        isLoaded: true,
        isLoading: false,
        error: null,
        appId: config.appId,
        configId: config.configId,
      });
    };

    // Load SDK script
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Erro ao carregar o SDK do Facebook. Verifique sua conexão.',
        }));
      };
      document.body.appendChild(script);
    }
  }, [state.isLoaded, state.isLoading, fetchConfig]);

  // Start Embedded Signup flow
  const startEmbeddedSignup = useCallback((): Promise<EmbeddedSignupResult> => {
    return new Promise((resolve, reject) => {
      if (!window.FB) {
        reject(new Error('Facebook SDK não carregado'));
        return;
      }

      const loginOptions: Record<string, unknown> = {
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      };

      if (state.configId) {
        loginOptions.config_id = state.configId;
      }

      window.FB.login(
        (response: any) => {
          if (response.authResponse) {
            const result: EmbeddedSignupResult = {
              code: response.authResponse.code,
            };

            // Try to extract session info (WABA ID, phone number ID)
            if (response.authResponse.declinedPermissions?.length > 0) {
              reject(new Error('Permissões insuficientes. Autorize todas as permissões solicitadas.'));
              return;
            }

            resolve(result);
          } else {
            reject(new Error('Autorização cancelada pelo usuário.'));
          }
        },
        loginOptions,
      );
    });
  }, [state.configId]);

  return {
    ...state,
    loadSDK,
    startEmbeddedSignup,
  };
}
