import { queueLog } from '../services/logger.js';
import { generateAIResponse } from '../services/gemini.service.js';

function dividirTexto(texto, limite = 1900) {
  const partes = [];
  let inicio = 0;
  
  while (inicio < texto.length) {
    let fin = Math.min(inicio + limite, texto.length);
    
    if (fin < texto.length) {
      const ultimoPunto = texto.lastIndexOf('.', fin);
      const ultimoSalto = texto.lastIndexOf('\n', fin);
      const ultimoEspacio = texto.lastIndexOf(' ', fin);
      const puntoCorte = Math.max(ultimoPunto, ultimoSalto, ultimoEspacio);
      
      if (puntoCorte > inicio) {
        fin = puntoCorte + 1;
      }
    }
    
    partes.push(texto.slice(inicio, fin).trim());
    inicio = fin;
  }
  
  return partes;
}

// Diferentes estilos de barra de progreso
function crearBarraProgreso(actual, total, estilo = 'default') {
  const porcentaje = Math.round((actual / total) * 100);
  const tamaño = 20;
  const completado = Math.round((actual / total) * tamaño);
  const vacio = tamaño - completado;
  
  if (estilo === 'simple') {
    return `[${'█'.repeat(completado)}${'░'.repeat(vacio)}] ${porcentaje}%`;
  }
  
  if (estilo === 'emoji') {
    const emojis = ['⬜', '🟨', '🟩'];
    if (actual === total) return '✅ 100%';
    if (porcentaje > 75) return `🟩 ${porcentaje}%`;
    if (porcentaje > 50) return `🟨 ${porcentaje}%`;
    return `⬜ ${porcentaje}%`;
  }
  
  // Default: con números
  const emoji = actual === total ? '✅' : '⏳';
  return `${emoji} \`[${'█'.repeat(completado)}${'░'.repeat(vacio)}]\` ${actual}/${total} (${porcentaje}%)`;
}

// Spinners animados
function obtenerSpinner(iteracion) {
  const spinners = ['⏳', '⌛', '⏳', '⌛'];
  return spinners[iteracion % spinners.length];
}

// Helper para convertir la imagen adjunta de Discord a Base64
async function obtenerImagenData(attachment) {
  if (!attachment || !attachment.contentType?.startsWith('image/')) {
    return null;
  }

  try {
    const response = await fetch(attachment.url);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      mimeType: attachment.contentType,
      data: base64
    };
  } catch (error) {
    console.error('Error al descargar la imagen de Discord:', error);
    return null;
  }
}

export async function handleMessageCreate(message, client) {
    if (message.author.bot || !message.guild) return;

    queueLog(message);

    if (message.mentions.has(client.user)) {
        try {
            await message.channel.sendTyping();
            
            // Mostrar mensaje de "pensando"
            const msgPensando = await message.reply('**Pensando...**');
            
            // Extraer adjuntos si el usuario envió una imagen
            const attachment = message.attachments.first();
            const imageData = await obtenerImagenData(attachment);

            // Limpiar la mención del bot en el texto enviado a la IA
            const promptTexto = message.content.replace(/<@!?\d+>/g, '').trim();

            const reply = await generateAIResponse(promptTexto, imageData);
            
            // Actualizar que ya terminó de pensar
            await msgPensando.edit('**Procesando respuesta...**');
            
            const partes = dividirTexto(reply);
            
            if (partes.length === 1) {
                await msgPensando.delete();
                await message.reply(partes[0]);
                return;
            }
            
            // Mostrar barra de progreso inicial
            const mensajeProgreso = await message.channel.send(
                ` **Enviando respuesta en ${partes.length} partes**\n\n` +
                `${crearBarraProgreso(0, partes.length)}\n\n` +
                ` Preparando...`
            );
            
            // Eliminar mensaje de "pensando"
            await msgPensando.delete();
            
            // Enviar partes con barra de progreso
            let spinnerIteracion = 0;
            
            for (let i = 0; i < partes.length; i++) {
                // Enviar la parte (CORREGIDO: ternario con : '')
                const prefijo = i === 0 ? '**Comienza la respuesta:**\n\n' : '';
                await message.channel.send(`${prefijo}${partes[i]}`);
                
                // Actualizar barra de progreso con spinner animado
                spinnerIteracion++;
                const spinner = obtenerSpinner(spinnerIteracion);
                const progreso = crearBarraProgreso(i + 1, partes.length);
                
                await mensajeProgreso.edit(
                    ` **Enviando respuesta...**\n\n` +
                    `${progreso}\n\n` +
                    `${spinner} Enviando parte ${i + 1} de ${partes.length}`
                );
                
                if (i < partes.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 600));
                }
            }
            
            // Mensaje final con check
            await mensajeProgreso.edit(
                ` Respuesta Enviada \n\n` +
                `${crearBarraProgreso(partes.length, partes.length)}\n\n` +
                ` ${partes.length} partes enviadas exitosamente.`
            );
            
        } catch (err) {
            console.error("Error al responder como IA:", err);
            await message.reply('Lo siento, hubo un error al procesar tu mensaje.');
        }
    }
}