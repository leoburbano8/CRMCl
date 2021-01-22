const  Usuario = require('../models/Usuario');
const  Producto = require('../models/Producto');
const  Cliente = require('../models/Cliente');
const  Pedido = require('../models/Pedidos');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'variables.env'});

const crearToken = (usuario, secreta, expiresIn) => {
    //console.log(usuario);
    const { id, email, nombre, apellido } = usuario;

    return jwt.sign({ id, email, nombre, apellido  }, secreta, { expiresIn } )
}

//Resolvers
const resolvers = {
    Query: {
        obtenerUsuario: async (_, {}, ctx) => {
            
            return ctx.usuario;
        },
        obtenerProductos: async () => {
            try {
                const productos = await Producto.find({});
                return productos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerProducto: async (_, { id }) => {
            //Revisamos si el producto existe
            const producto = await Producto.findById(id);

            if(!producto) {
                throw new  Error('Producto no encontrado');
            }
            return producto;
        },
        obtenerClientes: async() => {
            try {
                const clientes = await Cliente.find({});
                return clientes;
            } catch (error) {
                console.log(error); 
            }
        },
        obtenerClientesVendedor: async (_, {}, ctx) => {
            try {
                const clientes = await Cliente.find({ vendedor: ctx.usuario.id.toString()});
                return clientes;
            } catch (error) {
                console.log(error); 
            }
        },
        obtenerCliente:  async (_, { id }, ctx ) => {
            //Revisar si el cliente existe
            const cliente = await Cliente.findById(id);

            if(!cliente){
                throw new  Error('Cliente no encontrado');
            }

            //Quien lo creo puede verlo
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new  Error('No tienes los permisos necesarios');
            }

            return cliente;
        },
        obtenerPedidos: async () => {
            try {
                const pedidos = await Pedido.find({});
                return pedidos;
            } catch (error) {
                console.log(error); 
            }
        },
        obtenerPedidosVendedor: async (_, {}, ctx) => {
            try {
                const pedidos = await Pedido.find({ vendedor: ctx.usuario.id}).populate('cliente');
                return pedidos;
            } catch (error) {
                console.log(error); 
            }
        },
        obtenerPedido: async (_, {id}, ctx) => {
            //Revisar si el pedido existe
            const pedido = await Pedido.findById(id);

            if(!pedido){
                throw new  Error('Pedido no encontrado');
            }

            //Quien lo creo puede verlo
            if(pedido.vendedor.toString() !== ctx.usuario.id){
                throw new  Error('No tienes los permisos necesarios');
            }
            //Retornamos el resultado
            return pedido;
        },
        obtenerPedidosEstado: async (_, {estado}, ctx) => {
            const pedidos = await Pedido.find({ vendedor: ctx.usuario.id, estado});
            
            return pedidos;
        },
        mejoresClientes: async () => {
            const clientes = await Pedido.aggregate([
                {$match: {estado: "COMPLETADO"}},
                {$group:{
                    _id: "$cliente",
                    total: {$sum: '$total'}
                }},
                {
                    $lookup: {
                        from: 'clientes',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'cliente'
                    }
                },
                {
                    $limit: 10
                },
                {
                    $sort: {total: -1}
                }
            ]);
            return clientes;
        },
        mejoresVendedores: async () => {
            const vendedores = await Pedido.aggregate([
                {$match: {estado: "COMPLETADO"}},
                {$group:{
                    _id: "$vendedor",
                    total: {$sum: '$total'}
                }},
                {
                    $lookup: {
                        from: 'usuarios',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'vendedor'
                    }
                },
                {
                    $limit: 3
                },
                {
                    $sort: {total: -1}
                }
            ]);
            return vendedores;
        },
        buscarProducto: async(_, {texto}) => {
            const productos = await Producto.find({ $text: { $search: texto}}).limit(10)

            return productos;
        } 
    },
    Mutation: {
        nuevoUsuario: async (_, { input } ) =>{
            
            const {email, password} = input;

            //Revisar si el usuario ya esta registrado
            const existeUsuario = await Usuario.findOne({email});
            if (existeUsuario){
                throw new  Error('El usuario ya esta registrado');
            }

            //Hashear el password
            const salt = bcryptjs.genSaltSync(10);
            input.password = bcryptjs.hashSync(password, salt);
         
            try {
                //Guardarlo en la base de datos
                const usuario = new Usuario(input);
                usuario.save(); 
                return usuario;
            } catch (error) {
                console.log(error);
            }
        }, autenticarUsuario: async (_, { input }) => {
            
            const {email, password} = input;
            
            //Revisar si el usuario existe
            const existeUsuario = await Usuario.findOne({email});
            if (!existeUsuario){
                throw new  Error('El usuario no existe');
            }

            //Revisar si el password es correcto
            const passwordCorrecto = bcryptjs.compareSync(password, existeUsuario.password);
            if (!passwordCorrecto){
                throw new  Error('El password no es correcto'); 
            }

            //Crear el token
            return{
                token: crearToken(existeUsuario, process.env.SECRETA, '2h')
            }
        }, 
        nuevoProducto: async (_, { input }) => {
            try {
                const producto = new Producto(input);

                //Almacenar en la DB
                const resultado = await producto.save();

                return resultado;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarProducto: async (_, {id, input}) => {
            //Revisamos si el producto existe
            let producto = await Producto.findById(id);

            if(!producto) {
                throw new  Error('Producto no encontrado');
            }
            
            //Guardarlo en la DB
            producto = await Producto.findOneAndUpdate({_id: id }, input, {new: true});
            
            return producto;
        },
        eliminarProducto: async (_, { id }) => {
            //Revisamos si el producto existe
            let producto = await Producto.findById(id);

            if(!producto) {
                throw new  Error('Producto no encontrado');
            }
            
            //Eliminar el producto
            await Producto.findByIdAndDelete({_id: id});

            return "Producto Eliminado!";
        },
        nuevoCliente: async (_, { input }, ctx) => {
            console.log(ctx);
            const {email} = input;
            //Verificar si el cliente ya existe
            //console.log(input);
            const cliente = await Cliente.findOne({ email });
            if(cliente){
                throw new  Error('El Cliente ya esta registrado');
            }

            const nuevoCliente = new Cliente(input);
            //Asignar al vendedor
            nuevoCliente.vendedor = ctx.usuario.id ;

            //Guardamos en la DB
            try {
                const resultado = await nuevoCliente.save();
                return resultado;
            } catch (error) {
                console.log(error);
            }

        },
        actualizarCliente: async (_, {id, input}, ctx) => {
            //Revisamos si el cliente existe
            let cliente = await Cliente.findById(id);

            if(!cliente) {
                throw new  Error('Cliente no encontrado');
            }

            //Verificar si el vendedor es quien edita
             if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new  Error('No tienes los permisos necesarios');
            }
            
            //Guardarlo en la DB
            cliente = await Cliente.findOneAndUpdate({_id: id }, input, {new: true});
            
            return cliente;
        },
        eliminarCliente: async (_, { id }, ctx) => {
            //Revisamos si el producto existe
            let cliente = await Cliente.findById(id);

            if(!cliente) {
                throw new  Error('Cliente no encontrado');
            }

            //Verificar si el vendedor es quien elimina
            if(cliente.vendedor.toString() !== ctx.usuario.id){
                throw new  Error('No tienes los permisos necesarios');
            }
            
            //Eliminar el cliente
            await Cliente.findByIdAndDelete({_id: id});

            return "Cliente Eliminado!";
        },
        nuevoPedido: async (_, {input}, ctx) => {
            const {cliente} = input
            
            //Verificar si el cliente existe
            let clienteExiste = await Cliente.findById(cliente);

            if(!clienteExiste) {
                throw new  Error('Cliente no encontrado');
            }

            //Verificar si el cliente pertenece al usuario
            if(clienteExiste.vendedor.toString() !== ctx.usuario.id){
                throw new  Error('No tienes los permisos necesarios');
            }

            //Revisar que el stock este disponible 
            for await (const articulo of input.pedido){
                const {id} = articulo;

                const producto = await Producto.findById(id);

                if(articulo.cantidad > producto.stock){
                    throw new  Error(`El articulo: ${producto.nombre} excede la cantidad disponible`);
                } else{
                    //Restar la cantidad al stock
                    producto.stock = producto.stock-articulo.cantidad;

                    await producto.save();
                }          
            };

            //Crear un nuevo pedido
            const nuevoPedido = new Pedido(input);
            
            //Asignarle un vendedor
            nuevoPedido.vendedor = ctx.usuario.id;

            //Guardar en la DB
            const resultado = await nuevoPedido.save();
            return resultado;
        },
        actualizarPedido: async (_, {id, input}, ctx) => {
            const {cliente} = input;
            
            //Revisar si el pedido existe
            const pedido = await Pedido.findById(id);

            if(!pedido){
                throw new  Error('Pedido no encontrado');
            }

             //Revisar si el cliente existe
             const clienteExiste = await Cliente.findById(cliente);

             if(!clienteExiste){
                 throw new  Error('Cliente no encontrado');
             }

            //Si el cliente y el pedido pertenecen al vendedor
            if(clienteExiste.vendedor.toString() !== ctx.usuario.id){
                throw new  Error('No tienes los permisos necesarios');
            }

            //Revisar el stock
            if(input.pedido){
                for await (const articulo of input.pedido){
                    const {id} = articulo;
    
                    const producto = await Producto.findById(id);
    
                    if(articulo.cantidad > producto.stock){
                        throw new  Error(`El articulo: ${producto.nombre} excede la cantidad disponible`);
                    } else{
                        //Restar la cantidad al stock
                        producto.stock = producto.stock-articulo.cantidad;
    
                        await producto.save();
                    }          
                };
            }
            
                        
            //Guardarlo en la DB
            const resultado = await Pedido.findOneAndUpdate({_id: id }, input, {new: true});
            return resultado;
        },
        eliminarPedido: async (_, { id }, ctx) => {
            //Revisar si el pedido existe
            const pedido = await Pedido.findById(id);

            if(!pedido){
                throw new  Error('Pedido no encontrado');
            }

            //Verificar si el vendedor es quien lo borra
            if(pedido.vendedor.toString() !== ctx.usuario.id){
                throw new  Error('No tienes los permisos necesarios');
            }
            
            //Eliminar el cliente
            await Pedido.findByIdAndDelete({_id: id});

            return "Pedido Eliminado!";
        }
    }
}

module.exports = resolvers;