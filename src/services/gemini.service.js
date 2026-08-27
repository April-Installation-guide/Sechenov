import { GoogleGenAI } from '@google/genai';

class GeminiService {
    constructor() {
        this.ai = new GoogleGenAI({});
        this.defaultModel = 'gemma-4-31b-it';
    }

    async generateResponse(prompt, imageData = null, systemInstruction = null) {
        try {
            const config = {};
            if (systemInstruction) {
                config.systemInstruction = systemInstruction;
            }

            // Preparamos el contenido
            const contents = [];

            // Si se pasa una imagen ({ mimeType, data }), la agregamos
            if (imageData && imageData.mimeType && imageData.data) {
                contents.push({
                    inlineData: {
                        mimeType: imageData.mimeType,
                        data: imageData.data
                    }
                });
            }

            if (prompt) {
                contents.push(prompt);
            }

            const response = await this.ai.models.generateContent({
                model: this.defaultModel,
                contents: contents,
                config: config,
            });

            return response.text;
        } catch (error) {
            console.error('Error al generar respuesta con Gemini:', error);
            return 'Error 404';
        }
    }

    async chatWithHistory(history = [], newMessage, imageData = null, systemInstruction = null) {
        try {
            const chat = this.ai.chats.create({
                model: this.defaultModel,
                history: history,
                config: systemInstruction ? { systemInstruction } : undefined
            });

            let messagePayload = newMessage;

            if (imageData && imageData.mimeType && imageData.data) {
                const parts = [
                    {
                        inlineData: {
                            mimeType: imageData.mimeType,
                            data: imageData.data
                        }
                    }
                ];

                if (newMessage) {
                    parts.push({ text: newMessage });
                }

                messagePayload = parts;
            }

            const result = await chat.sendMessage({
                message: messagePayload
            });

            return result.text;
        } catch (error) {
            console.error('Error en el chat con historial de Gemini:', error);
            return 'Error 404, Porfavor intenta mas tarde';
        }
    }
}

const geminiService = new GeminiService();

export default geminiService;

export const generateAIResponse = async (prompt, imageData = null, systemInstruction = null) => {
    return await geminiService.generateResponse(prompt, imageData, systemInstruction);
};