import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import { MOVIES } from '@consumet/extensions';
import { StreamingServers } from '@consumet/extensions/dist/models';

import cache from '../../utils/cache';
import { redis } from '../../main';
import { Redis } from 'ioredis';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
//
const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  const flixhq = new MOVIES.FlixHQ();

  fastify.get('/', (_, rp) => {
    rp.status(200).send({
      intro:
        "Welcome to the flixhq provider: check out the provider's website @ https://flixhq.to/",
      routes: ['/:query', '/info', '/watch'],
      documentation: 'https://docs.consumet.org/#tag/flixhq',
    });
  });

  fastify.get('/:query', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = decodeURIComponent((request.params as { query: string }).query);

    const page = (request.query as { page: number }).page;

    let res = redis
      ? await cache.fetch(
        redis as Redis,
        `flixhq:${query}:${page}`,
        async () => await flixhq.search(query, page ? page : 1),
        60 * 60 * 6,
      )
      : await flixhq.search(query, page ? page : 1);

    reply.status(200).send(res);
  });

  fastify.get('/recent-shows', async (request: FastifyRequest, reply: FastifyReply) => {
    let res = redis
      ? await cache.fetch(
        redis as Redis,
        `flixhq:recent-shows`,
        async () => await flixhq.fetchRecentTvShows(),
        60 * 60 * 3,
      )
      : await flixhq.fetchRecentTvShows();

    res.forEach(async (movie) => {
      await prisma.movie.upsert({
        where: { mediaId: movie.id },
        update: {
          title: movie.title as string,
          image: movie.image as string,
          releaseDate: movie.releaseDate as string,
          duration: movie.duration as string,
          type: movie.type as string,
        },
        create: {
          mediaId: movie.id,
          title: movie.title as string,
          image: movie.image as string,
          releaseDate: movie.releaseDate as string,
          duration: movie.duration as string,
          type: movie.type as string,
        },
      });
    });

    reply.status(200).send(res);
  });

  fastify.get('/recent-movies', async (request: FastifyRequest, reply: FastifyReply) => {
    let res = redis
      ? await cache.fetch(
        redis as Redis,
        `flixhq:recent-movies`,
        async () => await flixhq.fetchRecentMovies(),
        60 * 60 * 3,
      )
      : await flixhq.fetchRecentMovies();

    res.forEach(async (movie) => {
      await prisma.movie.upsert({
        where: { mediaId: movie.id },
        update: {
          title: movie.title as string,
          image: movie.image as string,
          releaseDate: movie.releaseDate as string,
          duration: movie.duration as string,
          type: movie.type as string,
        },
        create: {
          mediaId: movie.id,
          title: movie.title as string,
          image: movie.image as string,
          releaseDate: movie.releaseDate as string,
          duration: movie.duration as string,
          type: movie.type as string,
        },
      });
    });

    reply.status(200).send(res);
  });

  fastify.get('/trending', async (request: FastifyRequest, reply: FastifyReply) => {
    const type = (request.query as { type: string }).type;
    try {
      if (!type) {
        const res = {
          results: [
            ...(await flixhq.fetchTrendingMovies()),
            ...(await flixhq.fetchTrendingTvShows()),
          ],
        };


        res.results.forEach(async (movie) => {
          await prisma.movie.upsert({
            where: { mediaId: movie.id },
            update: {
              title: movie.title as string,
              image: movie.image as string,
              releaseDate: movie.releaseDate as string,
              duration: movie.duration as string,
              type: movie.type as string,
            },
            create: {
              mediaId: movie.id,
              title: movie.title as string,
              image: movie.image as string,
              releaseDate: movie.releaseDate as string,
              duration: movie.duration as string,
              type: movie.type as string,
            },
          });
        });


        return reply.status(200).send(res);
      }

      let res = redis
        ? await cache.fetch(
          redis as Redis,
          `flixhq:trending:${type}`,
          async () =>
            type === 'tv'
              ? await flixhq.fetchTrendingTvShows()
              : await flixhq.fetchTrendingMovies(),
          60 * 60 * 3,
        )
        : type === 'tv'
          ? await flixhq.fetchTrendingTvShows()
          : await flixhq.fetchTrendingMovies();

      res.forEach(async (movie) => {
        await prisma.movie.upsert({
          where: { mediaId: movie.id },
          update: {
            title: movie.title as string,
            image: movie.image as string,
            releaseDate: movie.releaseDate as string,
            duration: movie.duration as string,
            type: movie.type as string,
          },
          create: {
            mediaId: movie.id,
            title: movie.title as string,
            image: movie.image as string,
            releaseDate: movie.releaseDate as string,
            duration: movie.duration as string,
            type: movie.type as string,
          },
        });
      });

      reply.status(200).send(res);
    } catch (error) {
      reply.status(500).send({
        message:
          'Something went wrong. Please try again later. or contact the developers.',
      });
    }
  });

  fastify.get('/info', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.query as { id: string }).id;

    if (typeof id === 'undefined')
      return reply.status(400).send({
        message: 'id is required',
      });

    try {
      let res = redis
        ? await cache.fetch(
          redis as Redis,
          `flixhq:info:${id}`,
          async () => await flixhq.fetchMediaInfo(id),
          60 * 60 * 3,
        )
        : await flixhq.fetchMediaInfo(id);

      reply.status(200).send(res);

      try {
        const genres = await Promise.all(
          (res.genres ?? []).map((genre: string) =>
            prisma.movieGenre.upsert({
              where: { genre: genre },
              update: { genre: genre },
              create: { genre: genre },
            })
          )
        );

        // Upsert the casts
        const casts = await Promise.all(
          (res.casts ?? []).map((cast: string) =>
            prisma.movieCast.upsert({
              where: { cast: cast },
              update: { cast: cast },
              create: { cast: cast },
            })
          )
        );

        // Upsert the tags
        const tags = await Promise.all(
          (res.tags ?? []).map((tag: string) =>
            prisma.movieTag.upsert({
              where: { tag: tag },
              update: { tag: tag },
              create: { tag: tag },
            })
          )
        );

        const movie = await prisma.movie.upsert({
          where: { mediaId: res.id },
          update: {
            title: res.title as string,
            image: res.image as string,
            coverImage: res.cover as string,
            description: res.description as string,
            production: res.production as string,
            country: res.country as string,
            rating: res.rating,
            releaseDate: res.releaseDate as string,
            duration: res.duration as string,
            type: res.type as string,
            genres: {
              connect: genres.map((genre) => ({ id: genre.id })),
            },
            casts: {
              connect: casts.map((cast) => ({ id: cast.id })),
            },
            tags: {
              connect: tags.map((tag) => ({ id: tag.id })),
            },
            
          },
          create: {
            mediaId: res.id,
            title: res.title as string,
            image: res.image as string,
            coverImage: res.image as string,
            description: res.description as string,
            production: res.production as string,
            country: res.country as string,
            rating: res.rating,
            releaseDate: res.releaseDate as string,
            duration: res.duration as string,
            type: res.type as string,
            genres: {
              connect: genres.map((genre) => ({ id: genre.id })),
            },
            casts: {
              connect: casts.map((cast) => ({ id: cast.id })),
            },
            tags: {
              connect: tags.map((tag) => ({ id: tag.id })),
            },
          },
        });

        await Promise.all(
          (res.episodes ?? []).map(async (ep) => {
            try {
              // console.log(`Upserting episode [INFO ROUTE]: ${ep.id}`)
              await prisma.episode.upsert({
                where: { episodeId: ep.id },
                update: {
                  movieId: movie.id,
                  title: ep.title
                },
                create: {
                  movieId: movie.id,
                  episodeId: ep.id,
                  title: ep.title
                }
              });
            } catch (error) {
              console.log(error)
              console.error(`Failed to upsert episode: ${ep.id}`);
              console.error(error);
            }
          })
        );
      } catch (error) {
        console.error('Failed to upsert movie:', error);
        reply.status(500).send({
          message: 'Something went wrong. Please try again later or contact the developers.',
        })
      }


    } catch (err) {
      reply.status(500).send({
        message:
          'Something went wrong. Please try again later. or contact the developers.',
      });
    }
  });

  fastify.get('/watch', async (request: FastifyRequest, reply: FastifyReply) => {
    const episodeId = (request.query as { episodeId: string }).episodeId;
    const mediaId = (request.query as { mediaId: string }).mediaId;
    const server = (request.query as { server: StreamingServers }).server;

    if (typeof episodeId === 'undefined')
      return reply.status(400).send({ message: 'episodeId is required' });
    if (typeof mediaId === 'undefined')
      return reply.status(400).send({ message: 'mediaId is required' });

    if (server && !Object.values(StreamingServers).includes(server))
      return reply.status(400).send({ message: 'Invalid server query' });

    try {
      let res = redis
        ? await cache.fetch(
          redis as Redis,
          `flixhq:watch:${episodeId}:${mediaId}:${server}`,
          async () => await flixhq.fetchEpisodeSources(episodeId, mediaId, server),
          60 * 30,
        )
        : await flixhq.fetchEpisodeSources(episodeId, mediaId, server);

      reply.status(200).send(res);



      const epId = await prisma.episode.findUnique({
        where: { episodeId: episodeId }
      })


      await Promise.all(
        res.sources.map(async (source) => {
          try {
            console.log(`Upserting episode: ${epId?.id}`)
            await prisma.episodeSource.upsert({
              where: { url: source.url },
              update: {
                quality: source.quality,
                episodeId: epId?.id || '',
              },
              create: {
                url: source.url,
                quality: source.quality as string,
                episodeId: epId?.id || '',
              }
            });
          } catch (error) {
            console.error(error);
          }
        })
      );



      const subtitlePromises = res.subtitles?.map(async (subtitle) => {
        console.log(`Upserting subtitle: ${subtitle.lang} for ${epId?.id}`)
        await prisma.episodeSubtitle.upsert({
          where: {
            url: subtitle.url,
          },
          update: {
            language: subtitle.lang || '',
            episodeId: epId?.id || '',
          },
          create: {
            url: subtitle.url,
            language: subtitle.lang || '',
            episodeId: epId?.id || '',
          }
        });
      });

      await Promise.all(subtitlePromises || []);

    } catch (err) {
      reply
        .status(500)
        .send({ message: 'Something went wrong. Please try again later.' });
      console.error(err);
    }


  });

  fastify.get('/servers', async (request: FastifyRequest, reply: FastifyReply) => {
    const episodeId = (request.query as { episodeId: string }).episodeId;
    const mediaId = (request.query as { mediaId: string }).mediaId;
    try {
      let res = redis
        ? await cache.fetch(
          redis as Redis,
          `flixhq:servers:${episodeId}:${mediaId}`,
          async () => await flixhq.fetchEpisodeServers(episodeId, mediaId),
          60 * 30,
        )
        : await flixhq.fetchEpisodeServers(episodeId, mediaId);

      reply.status(200).send(res);
    } catch (error) {
      reply.status(500).send({
        message:
          'Something went wrong. Please try again later. or contact the developers.',
      });
    }
  });
};

export default routes;
