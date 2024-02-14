import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import { ANIME } from '@consumet/extensions';
import { StreamingServers } from '@consumet/extensions/dist/models';
import cache from '../../utils/cache'; // Import your cache utility
import { Redis } from 'ioredis';
import { redis } from '../../main';

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  const gogoanime = new ANIME.Gogoanime();
  const redisClient = new Redis(); // Create a Redis client instance
  const TTL = 3;

  fastify.get('/', async (request, reply) => {
    const query = (request.query as { query?: string }).query;
    const page = (request.query as { page: number }).page || 1;

    const status = (request.query as { status?: string[] }).status;
    const genre = (request.query as { genre?: string[] }).genre;
    const sort = (request.query as { sort?: string }).sort;
    const type = (request.query as { type?: string[] }).type;
    const year = (request.query as { year?: string[] }).year;
    const country = (request.query as { country?: string[] }).country;

    try {
      const cacheKey = `gogoanime:search:${query}:${page}:${status}:${genre}:${sort}:${type}:${year}:${country}`;
      const res = await cache.fetch(
        redisClient as Redis,
        cacheKey,
        async () =>
          await gogoanime.search(
            query,
            page,
            status,
            genre,
            sort,
            type,
            year,
            country
          ),
        60 * 60 * TTL // Set expiry to TTL hours
      );
      reply.status(200).send(res);
    } catch (error) {
      if (error instanceof Error) {
        reply.status(500).send({ message: error.message });
      } else {
        reply.status(500).send({ message: 'An unknown error occurred' });
      }
    }
  });

  fastify.get('/info/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = decodeURIComponent((request.params as { id: string }).id);

    try {
      const cacheKey = `gogoanime:info:${id}`;
      const res = await cache.fetch(
        redisClient as Redis,
        cacheKey,
        async () => await gogoanime.fetchAnimeInfo(id),
        60 * 60 * TTL // Set expiry to TTL hours
      );

      reply.status(200).send(res);
    } catch (err) {
      reply
        .status(500)
        .send({ message: 'Something went wrong. Please try again later.' });
    }
  });

  fastify.get('/genre/:genre', async (request: FastifyRequest, reply: FastifyReply) => {
    const genre = (request.params as { genre: string }).genre;
    const page = (request.query as { page: number }).page;

    try {
      const cacheKey = `gogoanime:genre:${genre}:${page}`;
      const res = await cache.fetch(
        redisClient as Redis,
        cacheKey,
        async () => await gogoanime.fetchGenreInfo(genre, page),
        60 * 60 * TTL // Set expiry to TTL hours
      );

      reply.status(200).send(res);
    } catch {
      reply
        .status(500)
        .send({ message: 'Something went wrong. Please try again later.' });
    }
  });

  fastify.get('/genre/list', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const cacheKey = `gogoanime:genre:list`;
      const res = await cache.fetch(
        redisClient as Redis,
        cacheKey,
        async () => await gogoanime.fetchGenreList(),
        60 * 60 * TTL // Set expiry to TTL hours
      );

      reply.status(200).send(res);
    } catch {
      reply
        .status(500)
        .send({ message: 'Something went wrong. Please try again later.' });
    }
  });

  fastify.get(
    '/watch/:episodeId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const episodeId = (request.params as { episodeId: string }).episodeId;
      const server = (request.query as { server: StreamingServers }).server;

      if (server && !Object.values(StreamingServers).includes(server)) {
        reply.status(400).send('Invalid server');
      }

      try {
        const cacheKey = `gogoanime:watch:${episodeId}:${server}`;
        const res = await cache.fetch(
          redisClient as Redis,
          cacheKey,
          async () => await gogoanime.fetchEpisodeSources(episodeId, server),
          60 * 60 * TTL // Set expiry to TTL hours
        );

        reply.status(200).send(res);
      } catch (err) {
        reply
          .status(500)
          .send({ message: 'Something went wrong. Please try again later.' });
      }
    }
  );

  fastify.get(
    '/servers/:episodeId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const episodeId = (request.params as { episodeId: string }).episodeId;

      try {
        const cacheKey = `gogoanime:servers:${episodeId}`;
        const res = await cache.fetch(
          redisClient as Redis,
          cacheKey,
          async () => await gogoanime.fetchEpisodeServers(episodeId),
          60 * 60 * TTL // Set expiry to TTL hours
        );

        reply.status(200).send(res);
      } catch (err) {
        reply
          .status(500)
          .send({ message: 'Something went wrong. Please try again later.' });
      }
    }
  );

  fastify.get('/top-airing', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const page = (request.query as { page: number }).page;

      const cacheKey = `gogoanime:top-airing:${page}`;
      const res = await cache.fetch(
        redisClient as Redis,
        cacheKey,
        async () => await gogoanime.fetchTopAiring(page),
        60 * 60 * TTL // Set expiry to TTL hours
      );

      reply.status(200).send(res);
    } catch (err) {
      reply
        .status(500)
        .send({ message: 'Something went wrong. Contact developers for help.' });
    }
  });

  fastify.get('/movies', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const page = (request.query as { page: number }).page;

      const cacheKey = `gogoanime:movies:${page}`;
      const res = await cache.fetch(
        redisClient as Redis,
        cacheKey,
        async () => await gogoanime.fetchRecentMovies(page),
        60 * 60 * TTL // Set expiry to TTL hours
      );

      reply.status(200).send(res);
    } catch (err) {
      reply
        .status(500)
        .send({ message: 'Something went wrong. Contact developers for help.' });
    }
  });

  fastify.get('/popular', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const page = (request.query as { page: number }).page;

      const cacheKey = `gogoanime:popular:${page}`;
      const res = await cache.fetch(
        redisClient as Redis,
        cacheKey,
        async () => await gogoanime.fetchPopular(page),
        60 * 60 * TTL // Set expiry to TTL hours
      );

      reply.status(200).send(res);
    } catch (err) {
      reply
        .status(500)
        .send({ message: 'Something went wrong. Contact developers for help.' });
    }
  });

  fastify.get(
    '/recent-episodes',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const type = (request.query as { type: number }).type;
        const page = (request.query as { page: number }).page;

        const cacheKey = `gogoanime:recent-episodes:${type}:${page}`;
        const res = await cache.fetch(
          redisClient as Redis,
          cacheKey,
          async () => await gogoanime.fetchRecentEpisodes(page, type),
          60 * 60 * TTL // Set expiry to TTL hours
        );

        reply.status(200).send(res);
      } catch (err) {
        reply
          .status(500)
          .send({ message: 'Something went wrong. Contact developers for help.' });
      }
    }
  );

  // Close the Redis connection when the Fastify app is closed
  fastify.addHook('onClose', async () => {
    await redisClient.quit();
  });
};

export default routes;