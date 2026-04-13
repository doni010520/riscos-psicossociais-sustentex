// ============================================================================
// API CLIENT - Sustentex
// ============================================================================

import { FormSubmission, SubmissionResponse } from '@/types';

export const submitForm = async (data: FormSubmission): Promise<SubmissionResponse> => {
  const response = await fetch('/api/form/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      answers: data.answers,
      completion_time_seconds: data.completionTimeSeconds,
      user_agent: data.userAgent || navigator.userAgent,
    }),
  });

  if (!response.ok) {
    throw new Error('Erro ao enviar formulário');
  }

  const result = await response.json();

  return {
    id: result.response_id,
    message: 'Formulário enviado com sucesso!',
    submittedAt: new Date().toISOString(),
  };
};

export const logAccess = async (action: string, metadata?: any) => {
  try {
    await fetch('/api/form/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, metadata }),
    });
  } catch {
    // Log silencioso
  }
};
